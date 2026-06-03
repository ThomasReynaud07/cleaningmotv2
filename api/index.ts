import { Hono } from 'hono'
import { cors } from 'hono/cors'
import bcrypt from 'bcryptjs'
import { eq, desc, ilike, or, and, count, sql, ne, asc } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { db } from './lib/db.js'
import * as schema from './lib/schema.js'
import { signToken, authMiddleware, adminMiddleware, type JwtPayload } from './lib/auth.js'

export const config = { runtime: 'nodejs' }

const app = new Hono().basePath('/api')

app.use('*', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'] }))

// ─── Helpers ────────────────────────────────────────────────────────────────

function getUser(c: any): JwtPayload {
  return c.get('user') as JwtPayload
}

async function auditLog(
  actorId: number | null,
  action: string,
  targetType: string | null,
  targetId: number | null,
  payload: Record<string, unknown> | null
) {
  await db.insert(schema.auditLogs).values({ actorId, action, targetType, targetId, payload })
}

async function syncLabStatus(labId: number) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(schema.reports)
    .where(and(eq(schema.reports.labId, labId), eq(schema.reports.status, 'pending')))

  const status = Number(value) > 0 ? 'dirty' : 'clean'
  await db
    .update(schema.labs)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.labs.id, labId))
}

// ─── Auth ────────────────────────────────────────────────────────────────────

app.post('/auth/register', async (c) => {
  const body = await c.req.json<{
    firstName: string
    lastName: string
    email: string
    password: string
    passwordConfirmation: string
  }>()

  const { firstName, lastName, email, password, passwordConfirmation } = body

  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) {
    return c.json({ error: 'All fields are required' }, 422)
  }
  if (password !== passwordConfirmation) {
    return c.json({ error: 'Passwords do not match' }, 422)
  }
  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 422)
  }

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase()))
    .limit(1)

  if (existing.length > 0) {
    return c.json({ error: 'Email already in use' }, 422)
  }

  const hashed = await bcrypt.hash(password, 12)
  const [user] = await db
    .insert(schema.users)
    .values({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.toLowerCase().trim(), password: hashed })
    .returning()

  const token = await signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  })

  return c.json(
    {
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl ?? null,
      },
    },
    201
  )
})

app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 422)
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase().trim()))
    .limit(1)

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = await signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  })

  return c.json({
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
    },
  })
})

app.post('/auth/logout', authMiddleware, (c) => c.json({ ok: true }))

app.get('/auth/me', authMiddleware, async (c) => {
  const { sub } = getUser(c)
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, sub))
    .limit(1)

  if (!user) return c.json({ error: 'User not found' }, 404)

  return c.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
  })
})

// ─── Labs ─────────────────────────────────────────────────────────────────────

app.get('/labs', async (c) => {
  const rows = await db
    .select()
    .from(schema.labs)
    .orderBy(schema.labs.name)

  return c.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      building: r.building ?? null,
      location: r.location ?? null,
      floor: r.floor ?? null,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  )
})

app.get('/labs/:id', async (c) => {
  const id = Number(c.req.param('id'))

  const [lab] = await db
    .select()
    .from(schema.labs)
    .where(eq(schema.labs.id, id))
    .limit(1)

  if (!lab) return c.json({ error: 'Lab not found' }, 404)

  const reports = await db
    .select()
    .from(schema.reports)
    .where(eq(schema.reports.labId, id))
    .orderBy(desc(schema.reports.createdAt))

  const photos = await db
    .select()
    .from(schema.reportPhotos)
    .where(
      reports.length > 0
        ? sql`${schema.reportPhotos.reportId} = ANY(ARRAY[${sql.join(reports.map((r) => sql`${r.id}`), sql`, `)}]::int[])`
        : sql`false`
    )

  const lastUserIds = [...new Set(reports.map((r) => r.lastUserId).filter(Boolean))] as number[]
  const lastUsers =
    lastUserIds.length > 0
      ? await db
          .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
          .from(schema.users)
          .where(sql`${schema.users.id} = ANY(ARRAY[${sql.join(lastUserIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      : []

  const labComments = await db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.labId, id))
    .orderBy(desc(schema.comments.createdAt))

  return c.json({
    id: lab.id,
    name: lab.name,
    building: lab.building ?? null,
    location: lab.location ?? null,
    floor: lab.floor ?? null,
    status: lab.status,
    createdAt: lab.createdAt,
    updatedAt: lab.updatedAt,
    reports: reports.map((r) => ({
      id: r.id,
      labId: r.labId,
      userId: r.userId,
      reporterName: r.reporterName,
      description: r.description,
      status: r.status,
      reportType: r.reportType,
      workstationIdentifier: r.workstationIdentifier,
      lastUserFirstname: r.lastUserFirstname,
      lastUserLastname: r.lastUserLastname,
      lastUserId: r.lastUserId,
      lastUser: lastUsers.find((u) => u.id === r.lastUserId) ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      photos: photos.filter((p) => p.reportId === r.id),
    })),
    comments: labComments,
  })
})

app.post('/labs', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json<{
    name: string
    building?: 'A' | 'B' | 'C'
    location?: string
    floor?: string
  }>()

  if (!body.name?.trim()) return c.json({ error: 'Name is required' }, 422)

  const [lab] = await db
    .insert(schema.labs)
    .values({
      name: body.name.trim(),
      building: body.building ?? null,
      location: body.location?.trim() ?? null,
      floor: body.floor?.trim() ?? null,
    })
    .returning()

  await auditLog(getUser(c).sub, 'lab.created', 'lab', lab.id, { name: lab.name })

  return c.json(lab, 201)
})

app.put('/labs/:id', authMiddleware, async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{
    name?: string
    building?: 'A' | 'B' | 'C' | null
    location?: string | null
    floor?: string | null
    status?: 'clean' | 'dirty' | 'needs_attention'
  }>()

  const [existing] = await db.select().from(schema.labs).where(eq(schema.labs.id, id)).limit(1)
  if (!existing) return c.json({ error: 'Lab not found' }, 404)

  const updates: Partial<typeof schema.labs.$inferInsert> = { updatedAt: new Date() }
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.building !== undefined) updates.building = body.building
  if (body.location !== undefined) updates.location = body.location?.trim() ?? null
  if (body.floor !== undefined) updates.floor = body.floor?.trim() ?? null
  if (body.status !== undefined) updates.status = body.status

  const [lab] = await db.update(schema.labs).set(updates).where(eq(schema.labs.id, id)).returning()

  return c.json(lab)
})

app.delete('/labs/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number(c.req.param('id'))
  const [lab] = await db.select().from(schema.labs).where(eq(schema.labs.id, id)).limit(1)
  if (!lab) return c.json({ error: 'Lab not found' }, 404)

  await db.delete(schema.labs).where(eq(schema.labs.id, id))
  await auditLog(getUser(c).sub, 'lab.deleted', 'lab', id, { name: lab.name })

  return c.body(null, 204)
})

// ─── Reports ──────────────────────────────────────────────────────────────────

app.get('/labs/:labId/reports', async (c) => {
  const labId = Number(c.req.param('labId'))

  const reports = await db
    .select()
    .from(schema.reports)
    .where(eq(schema.reports.labId, labId))
    .orderBy(desc(schema.reports.createdAt))

  if (reports.length === 0) return c.json([])

  const photos = await db
    .select()
    .from(schema.reportPhotos)
    .where(
      sql`${schema.reportPhotos.reportId} = ANY(ARRAY[${sql.join(reports.map((r) => sql`${r.id}`), sql`, `)}]::int[])`
    )

  const lastUserIds = [...new Set(reports.map((r) => r.lastUserId).filter(Boolean))] as number[]
  const lastUsers =
    lastUserIds.length > 0
      ? await db
          .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
          .from(schema.users)
          .where(sql`${schema.users.id} = ANY(ARRAY[${sql.join(lastUserIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      : []

  return c.json(
    reports.map((r) => ({
      id: r.id,
      labId: r.labId,
      userId: r.userId,
      reporterName: r.reporterName,
      description: r.description,
      status: r.status,
      reportType: r.reportType,
      workstationIdentifier: r.workstationIdentifier,
      lastUserFirstname: r.lastUserFirstname,
      lastUserLastname: r.lastUserLastname,
      lastUserId: r.lastUserId,
      lastUser: lastUsers.find((u) => u.id === r.lastUserId) ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      photos: photos.filter((p) => p.reportId === r.id),
    }))
  )
})

app.post('/labs/:labId/reports', authMiddleware, async (c) => {
  const labId = Number(c.req.param('labId'))
  const currentUser = getUser(c)

  const [lab] = await db.select().from(schema.labs).where(eq(schema.labs.id, labId)).limit(1)
  if (!lab) return c.json({ error: 'Lab not found' }, 404)

  const formData = await c.req.parseBody({ all: true })

  const description = String(formData.description ?? '').trim()
  if (!description) return c.json({ error: 'Description is required' }, 422)

  const reportType = (formData.report_type as 'lab' | 'workstation') ?? 'lab'
  const workstationIdentifier = formData.workstation_identifier
    ? String(formData.workstation_identifier).trim()
    : null

  let lastUserId: number | null = null
  let lastUserFirstname: string | null = formData.last_user_firstname
    ? String(formData.last_user_firstname).trim()
    : null
  let lastUserLastname: string | null = formData.last_user_lastname
    ? String(formData.last_user_lastname).trim()
    : null

  if (formData.last_user_id) {
    const uid = Number(formData.last_user_id)
    const [lu] = await db
      .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
      .from(schema.users)
      .where(eq(schema.users.id, uid))
      .limit(1)
    if (lu) {
      lastUserId = lu.id
      lastUserFirstname = lu.firstName
      lastUserLastname = lu.lastName
    }
  }

  const [report] = await db
    .insert(schema.reports)
    .values({
      labId,
      userId: currentUser.sub,
      reporterName: `${currentUser.firstName} ${currentUser.lastName}`,
      description,
      reportType,
      workstationIdentifier,
      lastUserFirstname,
      lastUserLastname,
      lastUserId,
    })
    .returning()

  // Upload photos to Vercel Blob
  const rawPhotos = formData.photos
  const files = Array.isArray(rawPhotos) ? rawPhotos : rawPhotos ? [rawPhotos] : []
  const savedPhotos = []

  for (const file of files) {
    if (file instanceof File && file.size > 0) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp']
      if (!allowed.includes(ext)) continue
      if (file.size > 5 * 1024 * 1024) continue

      const blob = await put(`reports/${report.id}/${Date.now()}-${file.name}`, file, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })

      const [photo] = await db
        .insert(schema.reportPhotos)
        .values({ reportId: report.id, url: blob.url, originalName: file.name })
        .returning()
      savedPhotos.push(photo)
    }
  }

  // Update lab status
  await db
    .update(schema.labs)
    .set({ status: 'dirty', updatedAt: new Date() })
    .where(eq(schema.labs.id, labId))

  await auditLog(currentUser.sub, 'report.created', 'report', report.id, {
    labId,
    labName: lab.name,
    description,
  })

  return c.json({ ...report, photos: savedPhotos }, 201)
})

app.patch('/reports/:id/status', authMiddleware, adminMiddleware, async (c) => {
  const id = Number(c.req.param('id'))
  const { status } = await c.req.json<{ status: 'pending' | 'resolved' | 'ignored' }>()

  const allowed = ['pending', 'resolved', 'ignored']
  if (!allowed.includes(status)) return c.json({ error: 'Invalid status' }, 422)

  const [existing] = await db.select().from(schema.reports).where(eq(schema.reports.id, id)).limit(1)
  if (!existing) return c.json({ error: 'Report not found' }, 404)

  const [report] = await db
    .update(schema.reports)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.reports.id, id))
    .returning()

  await syncLabStatus(report.labId)

  await auditLog(getUser(c).sub, 'report.status_updated', 'report', id, {
    oldStatus: existing.status,
    newStatus: status,
    labId: report.labId,
  })

  return c.json(report)
})

app.delete('/reports/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number(c.req.param('id'))
  const [report] = await db.select().from(schema.reports).where(eq(schema.reports.id, id)).limit(1)
  if (!report) return c.json({ error: 'Report not found' }, 404)

  await db.delete(schema.reportPhotos).where(eq(schema.reportPhotos.reportId, id))
  await db.delete(schema.reports).where(eq(schema.reports.id, id))
  await syncLabStatus(report.labId)

  await auditLog(getUser(c).sub, 'report.deleted', 'report', id, {
    labId: report.labId,
    description: report.description,
  })

  return c.body(null, 204)
})

// ─── Comments ─────────────────────────────────────────────────────────────────

app.get('/labs/:labId/comments', async (c) => {
  const labId = Number(c.req.param('labId'))
  const rows = await db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.labId, labId))
    .orderBy(desc(schema.comments.createdAt))
  return c.json(rows)
})

app.post('/labs/:labId/comments', authMiddleware, async (c) => {
  const labId = Number(c.req.param('labId'))
  const { content } = await c.req.json<{ content: string }>()
  const currentUser = getUser(c)

  if (!content?.trim()) return c.json({ error: 'Content is required' }, 422)

  const [lab] = await db.select({ id: schema.labs.id }).from(schema.labs).where(eq(schema.labs.id, labId)).limit(1)
  if (!lab) return c.json({ error: 'Lab not found' }, 404)

  const [comment] = await db
    .insert(schema.comments)
    .values({
      labId,
      userId: currentUser.sub,
      authorName: `${currentUser.firstName} ${currentUser.lastName}`,
      content: content.trim(),
    })
    .returning()

  return c.json(comment, 201)
})

app.delete('/comments/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number(c.req.param('id'))
  const [comment] = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1)
  if (!comment) return c.json({ error: 'Comment not found' }, 404)

  await db.delete(schema.comments).where(eq(schema.comments.id, id))
  return c.body(null, 204)
})

// ─── Profile / Users ──────────────────────────────────────────────────────────

app.get('/me/warnings', authMiddleware, async (c) => {
  const { sub } = getUser(c)
  const rows = await db
    .select({
      id: schema.warnings.id,
      reason: schema.warnings.reason,
      createdAt: schema.warnings.createdAt,
      adminId: schema.warnings.adminId,
    })
    .from(schema.warnings)
    .where(eq(schema.warnings.userId, sub))
    .orderBy(desc(schema.warnings.createdAt))

  const adminIds = [...new Set(rows.map((r) => r.adminId))]
  const admins =
    adminIds.length > 0
      ? await db
          .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
          .from(schema.users)
          .where(sql`${schema.users.id} = ANY(ARRAY[${sql.join(adminIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      : []

  return c.json(
    rows.map((w) => ({
      id: w.id,
      reason: w.reason,
      createdAt: w.createdAt,
      admin: admins.find((a) => a.id === w.adminId) ?? null,
    }))
  )
})

app.get('/me/comments', authMiddleware, async (c) => {
  const { sub } = getUser(c)
  const rows = await db
    .select({
      id: schema.comments.id,
      content: schema.comments.content,
      createdAt: schema.comments.createdAt,
      labId: schema.comments.labId,
    })
    .from(schema.comments)
    .where(eq(schema.comments.userId, sub))
    .orderBy(desc(schema.comments.createdAt))

  const labIds = [...new Set(rows.map((r) => r.labId))]
  const labsList =
    labIds.length > 0
      ? await db
          .select({ id: schema.labs.id, name: schema.labs.name })
          .from(schema.labs)
          .where(sql`${schema.labs.id} = ANY(ARRAY[${sql.join(labIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      : []

  return c.json(
    rows.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      lab: labsList.find((l) => l.id === c.labId) ?? null,
    }))
  )
})

app.get('/users', authMiddleware, async (c) => {
  const rows = await db
    .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
    .from(schema.users)
    .orderBy(schema.users.firstName)
  return c.json(rows)
})

// ─── Admin ────────────────────────────────────────────────────────────────────

app.get('/admin/users', authMiddleware, adminMiddleware, async (c) => {
  const search = c.req.query('search')

  const conditions = search
    ? or(
        ilike(schema.users.firstName, `%${search}%`),
        ilike(schema.users.lastName, `%${search}%`),
        ilike(schema.users.email, `%${search}%`)
      )
    : undefined

  const userRows = conditions
    ? await db.select().from(schema.users).where(conditions).orderBy(desc(schema.users.createdAt))
    : await db.select().from(schema.users).orderBy(desc(schema.users.createdAt))

  if (userRows.length === 0) return c.json([])

  const warningRows = await db
    .select()
    .from(schema.warnings)
    .where(
      sql`${schema.warnings.userId} = ANY(ARRAY[${sql.join(userRows.map((u) => sql`${u.id}`), sql`, `)}]::int[])`
    )

  const adminIds = [...new Set(warningRows.map((w) => w.adminId))]
  const adminUsers =
    adminIds.length > 0
      ? await db
          .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
          .from(schema.users)
          .where(sql`${schema.users.id} = ANY(ARRAY[${sql.join(adminIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      : []

  return c.json(
    userRows.map((u) => {
      const userWarnings = warningRows
        .filter((w) => w.userId === u.id)
        .map((w) => ({
          id: w.id,
          reason: w.reason,
          createdAt: w.createdAt,
          admin: adminUsers.find((a) => a.id === w.adminId) ?? null,
        }))

      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        fullName: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        warningCount: userWarnings.length,
        warnings: userWarnings,
      }
    })
  )
})

app.get('/admin/users/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number(c.req.param('id'))
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
  if (!user) return c.json({ error: 'User not found' }, 404)

  const warningRows = await db
    .select()
    .from(schema.warnings)
    .where(eq(schema.warnings.userId, id))
    .orderBy(desc(schema.warnings.createdAt))

  const adminIds = [...new Set(warningRows.map((w) => w.adminId))]
  const adminUsers =
    adminIds.length > 0
      ? await db
          .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
          .from(schema.users)
          .where(sql`${schema.users.id} = ANY(ARRAY[${sql.join(adminIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      : []

  return c.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    warningCount: warningRows.length,
    warnings: warningRows.map((w) => ({
      id: w.id,
      reason: w.reason,
      createdAt: w.createdAt,
      admin: adminUsers.find((a) => a.id === w.adminId) ?? null,
    })),
  })
})

app.post('/admin/users/:id/warnings', authMiddleware, adminMiddleware, async (c) => {
  const userId = Number(c.req.param('id'))
  const { reason } = await c.req.json<{ reason: string }>()
  const admin = getUser(c)

  if (!reason?.trim()) return c.json({ error: 'Reason is required' }, 422)

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  if (!user) return c.json({ error: 'User not found' }, 404)

  const [warning] = await db
    .insert(schema.warnings)
    .values({ userId, adminId: admin.sub, reason: reason.trim() })
    .returning()

  await auditLog(admin.sub, 'warning.added', 'user', userId, {
    targetName: `${user.firstName} ${user.lastName}`,
    reason: reason.trim(),
  })

  return c.json(
    {
      id: warning.id,
      userId: warning.userId,
      reason: warning.reason,
      createdAt: warning.createdAt,
      admin: { id: admin.sub, firstName: admin.firstName, lastName: admin.lastName },
    },
    201
  )
})

app.delete('/admin/users/:id/warnings/:warningId', authMiddleware, adminMiddleware, async (c) => {
  const warningId = Number(c.req.param('warningId'))
  const [warning] = await db.select().from(schema.warnings).where(eq(schema.warnings.id, warningId)).limit(1)
  if (!warning) return c.json({ error: 'Warning not found' }, 404)

  await db.delete(schema.warnings).where(eq(schema.warnings.id, warningId))
  await auditLog(getUser(c).sub, 'warning.removed', 'user', warning.userId, { reason: warning.reason })

  return c.body(null, 204)
})

app.patch('/admin/users/:id/role', authMiddleware, adminMiddleware, async (c) => {
  const id = Number(c.req.param('id'))
  const { role } = await c.req.json<{ role: 'user' | 'admin' }>()

  if (role !== 'user' && role !== 'admin') return c.json({ error: 'Invalid role' }, 422)

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
  if (!user) return c.json({ error: 'User not found' }, 404)

  await db.update(schema.users).set({ role, updatedAt: new Date() }).where(eq(schema.users.id, id))

  await auditLog(getUser(c).sub, 'role.updated', 'user', id, {
    targetName: `${user.firstName} ${user.lastName}`,
    oldRole: user.role,
    newRole: role,
  })

  return c.json({ id, role })
})

app.get('/admin/audit-logs', authMiddleware, adminMiddleware, async (c) => {
  const page = Number(c.req.query('page') ?? '1')
  const perPage = 20
  const offset = (page - 1) * perPage

  const [{ total }] = await db.select({ total: count() }).from(schema.auditLogs)
  const logs = await db
    .select()
    .from(schema.auditLogs)
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(perPage)
    .offset(offset)

  const actorIds = [...new Set(logs.map((l) => l.actorId).filter(Boolean))] as number[]
  const actors =
    actorIds.length > 0
      ? await db
          .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
          .from(schema.users)
          .where(sql`${schema.users.id} = ANY(ARRAY[${sql.join(actorIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      : []

  return c.json({
    data: logs.map((l) => ({
      id: l.id,
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId,
      payload: l.payload,
      createdAt: l.createdAt,
      actor: actors.find((a) => a.id === l.actorId) ?? null,
    })),
    meta: {
      currentPage: page,
      lastPage: Math.ceil(Number(total) / perPage),
      total: Number(total),
      perPage,
    },
  })
})

// ─── Avatar ───────────────────────────────────────────────────────────────────

app.patch('/me/avatar', authMiddleware, async (c) => {
  const currentUser = getUser(c)
  const body = await c.req.formData()
  const file = body.get('avatar') as File | null
  if (!file) return c.json({ error: 'No file provided' }, 422)

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const blob = await put(`avatars/user-${currentUser.sub}-${Date.now()}.${ext}`, file, { access: 'public' })

  await db.update(schema.users).set({ avatarUrl: blob.url, updatedAt: new Date() }).where(eq(schema.users.id, currentUser.sub))

  return c.json({ avatarUrl: blob.url })
})

// ─── Messages ────────────────────────────────────────────────────────────────

async function getThread(userId: number) {
  const senderAlias = schema.users
  const msgs = await db
    .select({
      id: schema.messages.id,
      content: schema.messages.content,
      isRead: schema.messages.isRead,
      createdAt: schema.messages.createdAt,
      senderId: schema.messages.senderId,
      senderFirstName: senderAlias.firstName,
      senderLastName: senderAlias.lastName,
    })
    .from(schema.messages)
    .leftJoin(senderAlias, eq(senderAlias.id, schema.messages.senderId))
    .where(eq(schema.messages.userId, userId))
    .orderBy(asc(schema.messages.createdAt))
  return msgs
}

// User: count unread messages from admin
app.get('/me/messages/unread', authMiddleware, async (c) => {
  const user = getUser(c)
  const [{ value }] = await db
    .select({ value: count() })
    .from(schema.messages)
    .where(and(eq(schema.messages.userId, user.sub), ne(schema.messages.senderId, user.sub), eq(schema.messages.isRead, false)))
  return c.json({ unread: Number(value) })
})

// User: get own thread
app.get('/me/messages', authMiddleware, async (c) => {
  const user = getUser(c)
  const msgs = await getThread(user.sub)
  await db.update(schema.messages)
    .set({ isRead: true })
    .where(and(eq(schema.messages.userId, user.sub), ne(schema.messages.senderId, user.sub), eq(schema.messages.isRead, false)))
  return c.json(msgs.map(m => ({
    id: m.id, content: m.content, isRead: m.isRead, createdAt: m.createdAt,
    fromMe: m.senderId === user.sub,
    sender: { firstName: m.senderFirstName ?? '', lastName: m.senderLastName ?? '' },
  })))
})

// User: send message
app.post('/me/messages', authMiddleware, async (c) => {
  const user = getUser(c)
  const { content } = await c.req.json<{ content: string }>()
  if (!content?.trim()) return c.json({ error: 'Message required' }, 422)
  const [msg] = await db.insert(schema.messages)
    .values({ userId: user.sub, senderId: user.sub, content: content.trim() })
    .returning()
  return c.json({ ...msg, fromMe: true, sender: { firstName: user.firstName, lastName: user.lastName } }, 201)
})

// Admin: list all threads with unread count + last message
app.get('/admin/messages', authMiddleware, adminMiddleware, async (c) => {
  const threadRows = await db
    .selectDistinct({ userId: schema.messages.userId })
    .from(schema.messages)

  if (threadRows.length === 0) return c.json([])

  const userIds = threadRows.map(r => r.userId)
  const inArray = sql`${schema.messages.userId} = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::int[])`

  const [usersList, unreadRows, allMsgs] = await Promise.all([
    db.select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName })
      .from(schema.users)
      .where(sql`${schema.users.id} = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::int[])`),
    db.select({ userId: schema.messages.userId, unread: count() })
      .from(schema.messages)
      .where(and(inArray, sql`${schema.messages.senderId} = ${schema.messages.userId}`, eq(schema.messages.isRead, false)))
      .groupBy(schema.messages.userId),
    db.select({ userId: schema.messages.userId, content: schema.messages.content, createdAt: schema.messages.createdAt })
      .from(schema.messages)
      .where(inArray)
      .orderBy(desc(schema.messages.createdAt)),
  ])

  const result = userIds.map(userId => {
    const user = usersList.find(u => u.id === userId)
    const unreadRow = unreadRows.find(r => r.userId === userId)
    const lastMsg = allMsgs.find(m => m.userId === userId)
    return {
      user: { id: userId, firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' },
      unreadCount: Number(unreadRow?.unread ?? 0),
      lastMessage: (lastMsg?.content ?? '').slice(0, 80),
      lastMessageAt: lastMsg?.createdAt ?? null,
    }
  }).sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1
    if (a.unreadCount === 0 && b.unreadCount > 0) return 1
    const tA = a.lastMessageAt ? new Date(a.lastMessageAt as any).getTime() : 0
    const tB = b.lastMessageAt ? new Date(b.lastMessageAt as any).getTime() : 0
    return tB - tA
  })

  return c.json(result)
})

// Admin: count unread (messages sent by users, not yet read) — MUST be before /:userId
app.get('/admin/messages/unread', authMiddleware, adminMiddleware, async (c) => {
  const [{ value }] = await db
    .select({ value: count() })
    .from(schema.messages)
    .where(and(sql`${schema.messages.senderId} = ${schema.messages.userId}`, eq(schema.messages.isRead, false)))
  return c.json({ unread: Number(value) })
})

// Admin: get user thread
app.get('/admin/messages/:userId', authMiddleware, adminMiddleware, async (c) => {
  const userId = Number(c.req.param('userId'))
  const msgs = await getThread(userId)
  await db.update(schema.messages)
    .set({ isRead: true })
    .where(and(eq(schema.messages.userId, userId), eq(schema.messages.senderId, userId), eq(schema.messages.isRead, false)))
  return c.json(msgs.map(m => ({
    id: m.id, content: m.content, isRead: m.isRead, createdAt: m.createdAt,
    fromMe: m.senderId !== userId,
    sender: { firstName: m.senderFirstName ?? '', lastName: m.senderLastName ?? '' },
  })))
})

// Admin: reply to user
app.post('/admin/messages/:userId', authMiddleware, adminMiddleware, async (c) => {
  const admin = getUser(c)
  const userId = Number(c.req.param('userId'))
  const { content } = await c.req.json<{ content: string }>()
  if (!content?.trim()) return c.json({ error: 'Message required' }, 422)
  const [msg] = await db.insert(schema.messages)
    .values({ userId, senderId: admin.sub, content: content.trim() })
    .returning()
  return c.json({ ...msg, fromMe: true, sender: { firstName: admin.firstName, lastName: admin.lastName } }, 201)
})

const handler = (req: Request) => app.fetch(req)
export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler

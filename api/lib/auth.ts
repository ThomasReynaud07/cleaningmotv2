import { SignJWT, jwtVerify } from 'jose'
import type { Context, Next } from 'hono'

export interface JwtPayload {
  sub: number
  email: string
  role: 'user' | 'admin'
  firstName: string
  lastName: string
}

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({
    sub: String(payload.sub),
    email: payload.email,
    role: payload.role,
    firstName: payload.firstName,
    lastName: payload.lastName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return {
    sub: Number(payload.sub),
    email: payload['email'] as string,
    role: payload['role'] as 'user' | 'admin',
    firstName: payload['firstName'] as string,
    lastName: payload['lastName'] as string,
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('Authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = header.slice(7)
  try {
    const payload = await verifyToken(token)
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}

export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get('user') as JwtPayload | undefined
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
}

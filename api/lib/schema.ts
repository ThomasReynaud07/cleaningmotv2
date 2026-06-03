import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  varchar,
  pgEnum,
  json,
  boolean,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const roleEnum = pgEnum('role', ['user', 'admin'])
export const buildingEnum = pgEnum('building', ['A', 'B', 'C'])
export const labStatusEnum = pgEnum('lab_status', ['clean', 'dirty', 'needs_attention'])
export const reportStatusEnum = pgEnum('report_status', ['pending', 'resolved', 'ignored'])
export const reportTypeEnum = pgEnum('report_type', ['lab', 'workstation'])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password: text('password').notNull(),
  role: roleEnum('role').default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const labs = pgTable('labs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  building: buildingEnum('building'),
  location: text('location'),
  floor: text('floor'),
  status: labStatusEnum('status').default('clean').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  labId: integer('lab_id')
    .notNull()
    .references(() => labs.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  reporterName: text('reporter_name').notNull(),
  description: text('description').notNull(),
  status: reportStatusEnum('status').default('pending').notNull(),
  reportType: reportTypeEnum('report_type').default('lab').notNull(),
  workstationIdentifier: text('workstation_identifier'),
  lastUserFirstname: text('last_user_firstname'),
  lastUserLastname: text('last_user_lastname'),
  lastUserId: integer('last_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const reportPhotos = pgTable('report_photos', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id')
    .notNull()
    .references(() => reports.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  originalName: text('original_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  labId: integer('lab_id')
    .notNull()
    .references(() => labs.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  authorName: text('author_name').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const warnings = pgTable('warnings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  adminId: integer('admin_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  senderId: integer('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: integer('target_id'),
  payload: json('payload'),
  actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  reports: many(reports),
  comments: many(comments),
  warnings: many(warnings, { relationName: 'userWarnings' }),
  givenWarnings: many(warnings, { relationName: 'adminWarnings' }),
}))

export const labsRelations = relations(labs, ({ many }) => ({
  reports: many(reports),
  comments: many(comments),
}))

export const reportsRelations = relations(reports, ({ one, many }) => ({
  lab: one(labs, { fields: [reports.labId], references: [labs.id] }),
  user: one(users, { fields: [reports.userId], references: [users.id] }),
  lastUser: one(users, { fields: [reports.lastUserId], references: [users.id], relationName: 'lastUserReports' }),
  photos: many(reportPhotos),
}))

export const reportPhotosRelations = relations(reportPhotos, ({ one }) => ({
  report: one(reports, { fields: [reportPhotos.reportId], references: [reports.id] }),
}))

export const commentsRelations = relations(comments, ({ one }) => ({
  lab: one(labs, { fields: [comments.labId], references: [labs.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}))

export const warningsRelations = relations(warnings, ({ one }) => ({
  user: one(users, { fields: [warnings.userId], references: [users.id], relationName: 'userWarnings' }),
  admin: one(users, { fields: [warnings.adminId], references: [users.id], relationName: 'adminWarnings' }),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, { fields: [messages.userId], references: [users.id], relationName: 'userMessages' }),
  sender: one(users, { fields: [messages.senderId], references: [users.id], relationName: 'sentMessages' }),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}))

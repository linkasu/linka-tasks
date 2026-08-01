import { z } from 'zod'

export const idSchema = z.string().uuid()
export const usernameSchema = z.string().trim().toLowerCase().transform(value => value.replace(/^@/, '')).pipe(
  z.string().min(5).max(32).regex(/^[a-z0-9_]+$/),
)
export const roleSchema = z.enum(['owner', 'admin', 'member'])
export const userStateSchema = z.enum(['invited', 'active', 'suspended'])
export const prioritySchema = z.enum(['low', 'normal', 'high', 'urgent'])
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const isoDateSchema = z.iso.datetime({ offset: true })

export const requestOtpSchema = z.object({ username: usernameSchema }).strict()
export const verifyOtpSchema = z.object({
  username: usernameSchema,
  code: z.string().regex(/^\d{6}$/),
}).strict()

export const projectCreateSchema = z.object({
  key: z.string().trim().toUpperCase().min(2).max(12).regex(/^[A-Z][A-Z0-9]*$/),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(10_000).default(''),
}).strict()
export const projectUpdateSchema = projectCreateSchema.partial().strict()

export const statusCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: colorSchema,
  position: z.number().int().nonnegative().optional(),
  isDone: z.boolean().default(false),
}).strict()
export const statusUpdateSchema = statusCreateSchema.partial().strict()

export const labelCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: colorSchema,
}).strict()
export const labelUpdateSchema = labelCreateSchema.partial().strict()

export const taskCreateSchema = z.object({
  projectId: idSchema,
  statusId: idSchema,
  title: z.string().trim().min(1).max(300),
  description: z.string().max(100_000).default(''),
  priority: prioritySchema.default('normal'),
  assigneeId: idSchema.nullable().default(null),
  dueAt: isoDateSchema.nullable().default(null),
  estimateMinutes: z.number().int().positive().max(1_000_000).nullable().default(null),
  position: z.number().finite().default(0),
  labelIds: z.array(idSchema).max(50).default([]),
}).strict()
export const taskUpdateSchema = taskCreateSchema.omit({ projectId: true, labelIds: true }).partial().extend({
  version: z.number().int().positive(),
}).strict()

export const taskListQuerySchema = z.object({
  projectId: idSchema.optional(),
  statusId: idSchema.optional(),
  assigneeId: idSchema.optional(),
  labelId: idSchema.optional(),
  priority: prioritySchema.optional(),
  q: z.string().trim().max(200).optional(),
  trash: z.enum(['true', 'false']).default('false'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
}).strict()

export const taskLabelsSchema = z.object({ labelIds: z.array(idSchema).max(50) }).strict()
export const commentSchema = z.object({ body: z.string().trim().min(1).max(20_000) }).strict()
export const timeEntrySchema = z.object({
  minutes: z.number().int().positive().max(1_000_000),
  note: z.string().max(2_000).default(''),
  entryDate: z.iso.date(),
}).strict()
export const timeEntryUpdateSchema = timeEntrySchema.partial().strict()
export const recurrenceSchema = z.object({
  rule: z.string().trim().min(1).max(500),
  timezone: z.string().trim().min(1).max(100).default('UTC'),
  nextRunAt: isoDateSchema,
  state: z.enum(['active', 'paused']).default('active'),
}).strict()

export const attachmentPresignSchema = z.object({
  fileName: z.string().trim().min(1).max(255).refine(value => !/[\\/]/.test(value)),
  contentType: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(100 * 1024 * 1024),
}).strict()
export const attachmentFinalizeSchema = z.object({ etag: z.string().trim().min(1).max(200) }).strict()

export const inviteCreateSchema = z.object({
  username: usernameSchema,
  role: roleSchema.default('member'),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(72),
}).strict()
export const userUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  role: roleSchema.optional(),
  state: userStateSchema.optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
}).strict()

import axios from 'axios'

const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
})

export interface Lab {
  id: number
  name: string
  building: 'A' | 'B' | 'C' | null
  location: string | null
  floor: string | null
  status: 'clean' | 'dirty' | 'needs_attention'
  createdAt: string
  updatedAt: string
  reports?: Report[]
  comments?: Comment[]
}

export interface UserBasic {
  id: number
  firstName: string
  lastName: string
}

export interface Report {
  id: number
  labId: number
  userId: number | null
  reporterName: string
  description: string
  status: 'pending' | 'resolved' | 'ignored'
  reportType: 'lab' | 'workstation'
  workstationIdentifier: string | null
  lastUserFirstname: string | null
  lastUserLastname: string | null
  lastUserId: number | null
  lastUser?: { id: number; firstName: string; lastName: string } | null
  createdAt: string
  updatedAt: string
  photos?: ReportPhoto[]
}

export interface ReportPhoto {
  id: number
  reportId: number
  url: string
  originalName: string
}

export interface Comment {
  id: number
  labId: number
  userId: number | null
  authorName: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface AdminUser {
  id: number
  firstName: string
  lastName: string
  fullName: string | null
  email: string
  role: 'user' | 'admin'
  createdAt: string
  warningCount: number
  warnings: UserWarning[]
}

export interface UserWarning {
  id: number
  reason: string
  createdAt: string
  admin: { id: number; firstName: string; lastName: string }
}

export const labsApi = {
  getAll: () => api.get<Lab[]>('/api/labs'),
  getOne: (id: number) => api.get<Lab>(`/api/labs/${id}`),
  create: (data: { name: string; location?: string; floor?: string }) =>
    api.post<Lab>('/api/labs', data),
  update: (id: number, data: Partial<Lab>) => api.put<Lab>(`/api/labs/${id}`, data),
  delete: (id: number) => api.delete(`/api/labs/${id}`),
}

export const reportsApi = {
  getByLab: (labId: number) => api.get<Report[]>(`/api/labs/${labId}/reports`),
  create: (labId: number, formData: FormData) =>
    api.post<Report>(`/api/labs/${labId}/reports`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateStatus: (id: number, status: Report['status']) =>
    api.patch<Report>(`/api/reports/${id}/status`, { status }),
  delete: (id: number) => api.delete(`/api/reports/${id}`),
}

export const commentsApi = {
  getByLab: (labId: number) => api.get<Comment[]>(`/api/labs/${labId}/comments`),
  create: (labId: number, data: { content: string }) =>
    api.post<Comment>(`/api/labs/${labId}/comments`, data),
  delete: (id: number) => api.delete(`/api/comments/${id}`),
}

export interface MyWarning {
  id: number
  reason: string
  createdAt: string
  admin: { id: number; firstName: string; lastName: string }
}

export interface MyComment {
  id: number
  content: string
  createdAt: string
  lab: { id: number; name: string } | null
}

export const profileApi = {
  myWarnings: () => api.get<MyWarning[]>('/api/me/warnings'),
  myComments: () => api.get<MyComment[]>('/api/me/comments'),
  listUsers: () => api.get<UserBasic[]>('/api/users'),
}

export const adminApi = {
  getUsers: (search?: string) =>
    api.get<AdminUser[]>('/api/admin/users', { params: search ? { search } : {} }),
  getUser: (id: number) => api.get<AdminUser>(`/api/admin/users/${id}`),
  addWarning: (userId: number, reason: string) =>
    api.post<UserWarning>(`/api/admin/users/${userId}/warnings`, { reason }),
  removeWarning: (userId: number, warningId: number) =>
    api.delete(`/api/admin/users/${userId}/warnings/${warningId}`),
  updateRole: (userId: number, role: 'user' | 'admin') =>
    api.patch(`/api/admin/users/${userId}/role`, { role }),
}

export interface AuditLog {
  id: number
  action: string
  targetType: string | null
  targetId: number | null
  payload: Record<string, any> | null
  createdAt: string
  actor: { id: number; firstName: string; lastName: string } | null
}

export interface AuditLogPage {
  data: AuditLog[]
  meta: { currentPage: number; lastPage: number; total: number; perPage: number }
}

export const auditApi = {
  getLogs: (page = 1) => api.get<AuditLogPage>('/api/admin/audit-logs', { params: { page } }),
}

export interface Message {
  id: number
  content: string
  isRead: boolean
  createdAt: string
  fromMe: boolean
  sender: { firstName: string; lastName: string }
}

export const messagesApi = {
  getThread: () => api.get<Message[]>('/api/me/messages'),
  send: (content: string) => api.post<Message>('/api/me/messages', { content }),
}

export const adminMessagesApi = {
  getThread: (userId: number) => api.get<Message[]>(`/api/admin/messages/${userId}`),
  reply: (userId: number, content: string) => api.post<Message>(`/api/admin/messages/${userId}`, { content }),
  unreadCount: () => api.get<{ unread: number }>('/api/admin/messages/unread'),
}

export const getPhotoUrl = (url: string) => url

export default api

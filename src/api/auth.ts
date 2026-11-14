import { http, type Envelope } from './client'

// Skema OpenAPI auth masih `additionalProperties: true`, jadi bentuk ditulis di sini mengikuti
// handler BE (backend/internal/handler/auth.go, service.UserView/Session). Ganti ke tipe generate
// begitu BE mengetik skemanya.
export interface UserView {
  id: string
  email: string
  name: string
  phone: string | null
  phone_verified: boolean
  email_verified: boolean
  role: string
  locale: 'id' | 'en'
  mfa_enabled: boolean
  avatar_key?: string
  created_at: string
}

export interface Session {
  access_token: string
  expires_at: string
  session_id: string
  user: UserView
}

export interface RegisterInput {
  email: string
  password: string
  name: string
  locale?: 'id' | 'en'
  accept_terms: boolean
}

export interface LoginInput {
  email: string
  password: string
  mfa_code?: string
  mfa_method?: 'totp' | 'email' | 'sms'
}

const XHR = { 'X-Requested-With': 'XMLHttpRequest' } // wajib untuk endpoint berbasis cookie (csrfOK)

export async function register(input: RegisterInput): Promise<Session> {
  const r = await http.post<Envelope<Session>>('/auth/register', input)
  return r.data.data
}

export async function login(input: LoginInput): Promise<Session> {
  const r = await http.post<Envelope<Session>>('/auth/login', input)
  return r.data.data
}

export async function refresh(): Promise<Session> {
  const r = await http.post<Envelope<Session>>('/auth/refresh', {}, { headers: XHR })
  return r.data.data
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout', {}, { headers: XHR })
}

export async function forgotPassword(email: string): Promise<void> {
  await http.post('/auth/password/forgot', { email })
}

export async function resetPassword(
  token: string,
  password: string,
  sf: { mfa_method?: string; mfa_code?: string } = {},
): Promise<void> {
  await http.post('/auth/password/reset', { token, password, ...sf })
}

export async function verifyEmail(token: string): Promise<void> {
  await http.post('/auth/email/verify', { token })
}

export async function resendVerifyEmail(): Promise<void> {
  await http.post('/auth/email/verify/send', {})
}

export async function sendPhoneOtp(
  phone: string,
  password?: string,
): Promise<{ sent: boolean; expires_in: number }> {
  const r = await http.post<Envelope<{ sent: boolean; expires_in: number }>>('/auth/otp/send', {
    phone,
    ...(password ? { password } : {}),
  })
  return r.data.data
}

export async function verifyPhoneOtp(code: string): Promise<void> {
  await http.post('/auth/otp/verify', { code })
}

export async function me(): Promise<UserView> {
  const r = await http.get<Envelope<UserView>>('/me')
  return r.data.data
}

export async function confirmEmailChange(token: string): Promise<void> {
  await http.post('/auth/email/change/confirm', { token })
}

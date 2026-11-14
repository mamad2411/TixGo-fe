import { http, type Envelope } from './client'

// Verifikasi berlapis. Faktor kedua adalah sifat AKUN (berlaku di login dari perangkat/peramban mana pun) dan juga
// diminta untuk reset sandi, ganti sandi, ganti email, dan hapus akun. Kode pemulihan dipakai lewat metode "totp".
export type MfaMethod = 'totp' | 'email' | 'sms'
export type OtpMethod = 'email' | 'sms'

export interface MfaStatus {
  enabled: boolean
  methods: MfaMethod[]
  email_masked: string
  email_verified: boolean
  phone_masked?: string
  phone_verified: boolean
  recovery_left: number
}
/** Faktor kedua yang dikirim bersama aksi sensitif. */
export interface SecondFactor {
  mfa_method?: MfaMethod
  mfa_code?: string
}
export interface OtpSent {
  sent: boolean
  to: string
  expires_in: number
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const r = await http.get<Envelope<MfaStatus>>('/me/mfa')
  return r.data.data
}
export async function startOtpEnroll(method: OtpMethod): Promise<OtpSent> {
  const r = await http.post<Envelope<OtpSent>>(`/me/mfa/otp/${method}/start`)
  return r.data.data
}
/** Mengembalikan kode pemulihan bila ini faktor pertama (hanya ditampilkan sekali). */
export async function confirmOtpEnroll(method: OtpMethod, code: string): Promise<string[]> {
  const r = await http.post<Envelope<{ recovery_codes: string[] | null }>>(
    `/me/mfa/otp/${method}/confirm`,
    { code },
  )
  return r.data.data.recovery_codes ?? []
}
export async function sendStepUp(method: OtpMethod): Promise<OtpSent> {
  const r = await http.post<Envelope<OtpSent>>('/me/mfa/step-up/send', { method })
  return r.data.data
}
export async function disableMfaMethod(
  method: MfaMethod,
  password: string,
  code: string,
  codeMethod: MfaMethod,
): Promise<void> {
  await http.delete(`/me/mfa/methods/${method}`, {
    data: { password, code, code_method: codeMethod },
  })
}
/** Setelah sandi benar: kirim OTP login ke email/HP. */
export async function sendLoginOtp(
  email: string,
  password: string,
  method: OtpMethod,
): Promise<OtpSent> {
  const r = await http.post<Envelope<OtpSent>>('/auth/mfa/send', { email, password, method })
  return r.data.data
}

export interface ResetInfo {
  second_factor: 'none' | 'mfa' | 'phone'
  methods: MfaMethod[]
  email_masked?: string
  phone_masked?: string
}
export async function getResetInfo(token: string): Promise<ResetInfo> {
  const r = await http.post<Envelope<ResetInfo>>('/auth/password/reset/info', { token })
  return r.data.data
}
export async function sendResetOtp(token: string, method: OtpMethod): Promise<OtpSent> {
  const r = await http.post<Envelope<OtpSent>>('/auth/password/reset/send', { token, method })
  return r.data.data
}

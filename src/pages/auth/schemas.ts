import { field, shape, type Rule } from '@/utils/schema'

// Aturan cermin BE (FRD M1-F1, service.ValidatePasswordPolicy / NormalizePhone). Pesan = kunci i18n.

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

const email: Rule = (v) => {
  const s = text(v).trim()
  if (!s) return 'validation.required'
  if (s.length > 254) return 'validation.emailLong'
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? null : 'validation.email'
}

const password: Rule = (v) => {
  const s = text(v)
  if (s.length < 12) return 'validation.passwordMin'
  if (s.length > 128) return 'validation.passwordMax'
  return /\p{L}/u.test(s) && /\d/.test(s) ? null : 'validation.passwordMix'
}

// Saat masuk, kata sandi lama tidak diperiksa komposisinya: cukup terisi dan tidak kepanjangan.
const currentPassword: Rule = (v) => {
  const s = text(v)
  if (!s) return 'validation.required'
  return s.length > 128 ? 'validation.passwordMax' : null
}

export const newPassword = field(password)

export const loginSchema = shape({
  email,
  password: currentPassword,
  // mfa_code opsional dan tidak dirender di UI; panjangnya dijaga BE.
})

export const registerSchema = shape({
  name: (v) => {
    const s = text(v).trim()
    if (s.length < 2) return 'validation.nameMin'
    return s.length > 100 ? 'validation.nameMax' : null
  },
  email,
  password,
  accept_terms: (v) => (v === true ? null : 'validation.terms'),
})

export const forgotSchema = shape({ email })

export const resetSchema = shape({ password })

/** 08…, 62…, atau +… dengan 9-15 digit (BE menormalkan ke E.164). */
export const phoneSchema = shape({
  phone: (v) => {
    const s = text(v).trim()
    if (!s) return 'validation.required'
    return /^(\+|08|62)\d{8,14}$/.test(s.replace(/[\s().-]/g, '')) ? null : 'validation.phone'
  },
})

export const otpSchema = shape({ code: (v) => (/^\d{6}$/.test(text(v)) ? null : 'validation.otp') })

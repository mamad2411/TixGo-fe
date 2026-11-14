# pages/auth

Halaman auth di dalam `AuthLayout`: masuk, daftar, lupa/atur ulang sandi, verifikasi email, verifikasi HP (OTP). Validasi di `schemas.ts` memakai `@/utils/schema` (validator ~60 baris tanpa dependensi; dulu zod 122 kB hanya untuk lima form ini). Aturannya cermin BE dan pesannya = kunci i18n. Rute email mengikuti tautan BE (`/auth/verify-email`, `/auth/reset-password`).

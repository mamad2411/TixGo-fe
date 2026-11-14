import { isAxiosError } from 'axios'

/** Bentuk galat BE: `{ error: { code, message, request_id?, details? } }` (httpx.Fail). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string
  readonly details: Record<string, unknown>

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }

  /** Detik tunggu dari 429 (`details.retry_after`), bila ada. */
  get retryAfter(): number | undefined {
    const v = this.details.retry_after
    return typeof v === 'number' ? v : undefined
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string
    message?: string
    request_id?: string
    details?: Record<string, unknown>
  }
}

/** Ubah galat apa pun (axios/jaringan/lainnya) menjadi ApiError. Tanpa respons => NETWORK. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (isAxiosError<ErrorEnvelope>(err)) {
    const body = err.response?.data?.error
    if (err.response && body?.code) {
      return new ApiError(
        err.response.status,
        body.code,
        body.message ?? err.message,
        body.details,
        body.request_id,
      )
    }
    if (err.response) {
      return new ApiError(err.response.status, 'HTTP_' + err.response.status, err.message)
    }
    return new ApiError(0, err.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK', err.message)
  }
  return new ApiError(0, 'UNKNOWN', err instanceof Error ? err.message : String(err))
}

/** Kode galat yang punya terjemahan di i18n `errors.<KODE>`; selain itu jatuh ke `errors.generic`. */
const KNOWN = new Set([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'PHONE_TAKEN',
  'EMAIL_TAKEN',
  'OTP_INVALID',
  'OTP_LOCKED',
  'RATE_LIMITED',
  'EMAIL_NOT_VERIFIED',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'MFA_REQUIRED',
  'ACCOUNT_LOCKED',
  'INVALID_CREDENTIALS',
  'BLOCKED',
  'NETWORK',
  'TIMEOUT',
  'INTERNAL',
  'SEAT_TAKEN',
  'HOLD_EXPIRED',
  'LIMIT_EXCEEDED',
  'SALE_NOT_OPEN',
  'SALE_PAUSED',
  'SOLD_OUT',
  'NOT_ADMITTED',
  'QUEUE_CLOSED',
  'ADMISSION_EXPIRED',
  'PROMO_INVALID',
  'PROMO_EXHAUSTED',
  'CONSENT_REQUIRED',
  'AGE_CONFIRMATION_REQUIRED',
  'ORDER_NOT_PAYABLE',
  'INVALID_STATE',
])

export function errorI18nKey(e: ApiError): string {
  return KNOWN.has(e.code) ? `errors.${e.code}` : 'errors.generic'
}

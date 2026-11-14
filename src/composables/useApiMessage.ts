import { useI18n } from 'vue-i18n'

import { errorI18nKey, toApiError } from '@/api/errors'

/** Terjemahkan galat API ke pesan ramah. 5xx menyertakan kode rujukan untuk dukungan (FRD M28 AC6). */
export function useApiMessage() {
  const { t } = useI18n()
  return (e: unknown): string => {
    const err = toApiError(e)
    // Batas tiket: server mengirim angka nyatanya. Sebut angkanya, karena "melebihi batas"
    // saja tidak memberi tahu pengguna harus berbuat apa.
    if (err.code === 'LIMIT_EXCEEDED') {
      const limit = Number(err.details.limit)
      const already = Number(err.details.already)
      if (err.details.scope === 'account' && Number.isFinite(already) && Number.isFinite(limit))
        return t('errors.LIMIT_ACCOUNT', { already, limit })
      if (err.details.scope === 'order' && Number.isFinite(limit))
        return t('errors.LIMIT_ORDER', { limit })
    }
    let msg = t(errorI18nKey(err))
    if (err.status === 429 && err.retryAfter)
      msg += ' ' + t('errors.retryAfter', { s: err.retryAfter })
    if (err.status >= 500 && err.requestId)
      msg += ' ' + t('errors.requestId', { id: err.requestId })
    return msg
  }
}

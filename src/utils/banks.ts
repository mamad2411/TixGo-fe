/** Bank tujuan refund manual. Kode = nilai `bank_code` yang diterima BE (^[A-Za-z0-9_]{2,16}$). */
export const BANKS: { code: string; name: string }[] = [
  { code: 'BCA', name: 'BCA' },
  { code: 'MANDIRI', name: 'Bank Mandiri' },
  { code: 'BNI', name: 'BNI' },
  { code: 'BRI', name: 'BRI' },
  { code: 'BSI', name: 'BSI (Bank Syariah Indonesia)' },
  { code: 'CIMB', name: 'CIMB Niaga' },
  { code: 'PERMATA', name: 'Permata Bank' },
  { code: 'DANAMON', name: 'Bank Danamon' },
  { code: 'BTN', name: 'BTN' },
  { code: 'OCBC', name: 'OCBC' },
  { code: 'MAYBANK', name: 'Maybank Indonesia' },
  { code: 'JAGO', name: 'Bank Jago' },
  { code: 'SEABANK', name: 'SeaBank' },
]

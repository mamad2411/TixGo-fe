import type { InjectionKey, Ref } from 'vue'

import type { OrgEvent } from '@/api/organizer'

/** Event yang sedang dibuka di workspace organizer: dimuat sekali oleh layout, dipakai tab-tabnya. */
export interface OrgEventCtx {
  ev: Ref<OrgEvent | null>
  reload: () => Promise<void>
}
export const ORG_EVENT: InjectionKey<OrgEventCtx> = Symbol('orgEvent')

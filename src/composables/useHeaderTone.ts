import { onBeforeUnmount, ref, watchEffect, type Ref } from 'vue'

// Nada header lengket. Header tahu bagian halaman apa yang ada tepat di bawahnya:
// hero gelap -> 'dark'; bagian krem -> 'light'. Halaman menyatakannya lewat useHeaderTone().
export const headerTone = ref<'dark' | 'light'>('dark')

export function useHeaderTone(tone: Ref<'dark' | 'light'>): void {
  watchEffect(() => {
    headerTone.value = tone.value
  })
  onBeforeUnmount(() => {
    headerTone.value = 'dark'
  })
}

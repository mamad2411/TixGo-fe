import type * as T from 'three'

// Kit aset GLB hasil Blender (frontend/tools/venue-3d/build_assets.py -> public/models/*.glb).
export const KIT_NAMES = [
  'seat_lo',
  'seat',
  'stage',
  'barricade',
  'tower',
  'foh',
  'tent_bar',
  'tent_medic',
  'tent_merch',
  'toilet',
  'gate',
  'person',
] as const
export type KitName = (typeof KIT_NAMES)[number]
export type Kit = Record<KitName, T.Group>

let cache: Promise<Kit> | null = null

/** Muat semua GLB sekali (di-cache). Menolak bila salah satu gagal: pemanggil memutuskan cadangan. */
export function loadKit(): Promise<Kit> {
  cache ??= (async () => {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    const base = `${import.meta.env.BASE_URL}models/`
    const entries = await Promise.all(
      KIT_NAMES.map(async (n) => [n, (await loader.loadAsync(`${base}${n}.glb`)).scene] as const),
    )
    return Object.fromEntries(entries) as Kit
  })()
  cache.catch(() => (cache = null)) // izinkan coba lagi setelah gagal
  return cache
}

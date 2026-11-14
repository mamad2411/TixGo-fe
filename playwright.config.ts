import { defineConfig, devices } from '@playwright/test'

// E2E terpisah dari vitest (tests/). Setup: smoke + aksesibilitas dasar; alur beli masuk fase F3 (docs/13 §4).
// E2E_BASE_URL: uji build produksi (`pnpm build && pnpm preview` → http://localhost:4173) atau server lain.
// Bila diisi, tidak menyalakan/memakai-ulang server dev (hindari menguji aplikasi lain di port yang sama).
const externalBase = process.env.E2E_BASE_URL
const base = externalBase ?? 'http://localhost:5174'
// Banner cookie menutupi bagian bawah layar: spec lama memulai dengan pilihan sudah dibuat. Spec cookie menimpa ini.
const cookieDecided = {
  cookies: [],
  origins: [
    {
      origin: new URL(base).origin,
      localStorage: [
        {
          name: 'tixgo.cookie.v1',
          value: JSON.stringify({ analytics: false, marketing: false, subject: 'a:e2e' }),
        },
      ],
    },
  ],
}

export default defineConfig({
  testDir: 'e2e',
  // BE memakai hash kata sandi mahal (argon2/bcrypt >= 12): register/login bisa 2-8 dtk saat mesin sibuk.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Banyak spec memakai akun demo/pembeli bersama (batas beli 4 tiket/akun/event, satu hold aktif per akun).
  // Satu worker membuat hasil deterministik; paralel penuh menimbulkan kegagalan palsu karena rebutan akun.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: base, trace: 'on-first-retry', storageState: cookieDecided },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-375', use: { ...devices['Pixel 5'], viewport: { width: 375, height: 800 } } },
  ],
  webServer: externalBase
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:5174',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
})

import { expect, test } from '@playwright/test'

import {
  API_LOG,
  PASSWORD,
  lastOtp,
  newVerifiedUser,
  phoneOf,
  resetTokenFor,
  uiLogin,
} from './helpers'

// Verifikasi berlapis dengan BE nyata. Aturan sisi server (kunci setelah salah, sekali pakai, reset butuh faktor)
// diuji di backend: mfa_otp_test.go. Di sini yang dijaga: pengguna bisa mengaktifkan, login dari peramban lain
// menanyakannya, reset sandi tidak lolos hanya dengan tautan, dan ganti sandi meminta kode.
test.skip(!API_LOG, 'set E2E_API_LOG ke berkas log API dev (OTP dev hanya tercatat di log)')

const fresh = async (browser: import('@playwright/test').Browser) =>
  (await browser.newContext(test.info().project.use as never)).newPage()

test.describe('verifikasi berlapis', () => {
  test('aktifkan OTP email, login dari peramban lain meminta kode, lalu berhasil', async ({
    page,
    browser,
    request,
  }) => {
    const email = await newVerifiedUser(request)
    await uiLogin(page, email, '/keamanan')
    await page.locator('[data-test=otp-enable-email]').click()
    await expect(page.locator('[data-test=otp-enroll]')).toBeVisible()
    await page.locator('[data-test=otp-code]').fill('000000')
    await page.locator('[data-test=otp-confirm]').click()
    await expect(page.getByRole('alert').filter({ hasText: /kode/i }).first()).toBeVisible()
    await page.locator('[data-test=otp-code]').fill(lastOtp('email', email))
    await page.locator('[data-test=otp-confirm]').click()
    await expect(page.locator('[data-test=otp-recovery] code')).toHaveCount(8) // faktor pertama: kode pemulihan
    await expect(page.locator('[data-method=email]')).toHaveAttribute('data-on', 'true')

    // peramban lain (konteks baru, tanpa sesi) = login minta faktor kedua
    const p2 = await fresh(browser)
    await p2.goto('/masuk')
    await p2.getByLabel('Email').fill(email)
    await p2.locator('#password').fill(PASSWORD)
    await p2.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(p2.locator('[data-test=login-mfa]')).toBeVisible()
    await p2.locator('[data-test=mf-send]').click()
    await expect(p2.locator('[data-test=mf-sent]')).toBeVisible()
    await p2.locator('[data-test=mf-code]').fill('000000')
    await p2.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(p2.locator('[data-test=form-error]')).toBeVisible() // kode salah ditolak
    await p2.locator('[data-test=mf-code]').fill(lastOtp('email', email))
    await p2.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(p2.locator('[data-test=acct]')).toBeVisible({ timeout: 20_000 })
    await p2.context().close()
  })

  test('OTP SMS ke HP terverifikasi dipakai untuk login', async ({ page, browser, request }) => {
    const email = await newVerifiedUser(request)
    const phone = phoneOf(email)
    await uiLogin(page, email, '/keamanan')
    await page.locator('[data-test=otp-enable-sms]').click()
    await expect(page.locator('[data-test=otp-enroll]')).toBeVisible()
    await page.locator('[data-test=otp-code]').fill(lastOtp('sms', phone))
    await page.locator('[data-test=otp-confirm]').click()
    await expect(page.locator('[data-method=sms]')).toHaveAttribute('data-on', 'true')

    const p2 = await fresh(browser)
    await p2.goto('/masuk')
    await p2.getByLabel('Email').fill(email)
    await p2.locator('#password').fill(PASSWORD)
    await p2.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(p2.locator('[data-test=mf-send]')).toContainText('+62') // tujuan tersamar
    await p2.locator('[data-test=mf-send]').click()
    await expect(p2.locator('[data-test=mf-sent]')).toBeVisible()
    await p2.locator('[data-test=mf-code]').fill(lastOtp('sms', phone))
    await p2.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(p2.locator('[data-test=acct]')).toBeVisible({ timeout: 20_000 })
    await p2.context().close()
  })

  test('reset sandi: tautan email saja tidak cukup, butuh kode', async ({
    page,
    browser,
    request,
  }) => {
    const email = await newVerifiedUser(request)
    await uiLogin(page, email, '/keamanan')
    await page.locator('[data-test=otp-enable-email]').click()
    await expect(page.locator('[data-test=otp-enroll]')).toBeVisible() // tampil setelah kode terkirim
    await page.locator('[data-test=otp-code]').fill(lastOtp('email', email))
    await page.locator('[data-test=otp-confirm]').click()
    await expect(page.locator('[data-method=email]')).toHaveAttribute('data-on', 'true')

    const token = resetTokenFor(email)
    const p2 = await fresh(browser)
    await p2.goto(`/auth/reset-password?token=${token}`)
    await expect(p2.locator('[data-test=reset-mfa]')).toBeVisible()
    await p2.locator('#password').fill('Sandi-Baru-77xyz!')
    await p2.getByRole('button', { name: /ubah|atur|simpan|setel/i }).click()
    await expect(p2.locator('[data-test=form-error]')).toBeVisible() // tanpa kode: ditolak di klien
    await p2.locator('[data-test=mf-send]').click()
    await expect(p2.locator('[data-test=mf-sent]')).toBeVisible()
    await p2.locator('[data-test=mf-code]').fill(lastOtp('email', email))
    await p2.getByRole('button', { name: /ubah|atur|simpan|setel/i }).click()
    await expect(p2.locator('[data-test=reset-done]')).toBeVisible()
    await p2.context().close()
  })

  test('ganti sandi dari akun meminta kode faktor kedua', async ({ page, request }) => {
    const email = await newVerifiedUser(request)
    await uiLogin(page, email, '/keamanan')
    await page.locator('[data-test=otp-enable-email]').click()
    await expect(page.locator('[data-test=otp-enroll]')).toBeVisible() // tampil setelah kode terkirim
    await page.locator('[data-test=otp-code]').fill(lastOtp('email', email))
    await page.locator('[data-test=otp-confirm]').click()
    await expect(page.locator('[data-method=email]')).toHaveAttribute('data-on', 'true')

    const card = page.locator('[data-test=change-password]')
    await card.locator('[data-test=cpw-current]').fill(PASSWORD)
    await card.locator('[data-test=cpw-new]').fill('Sandi-Baru-77xyz!')
    await card.locator('[data-test=cpw-again]').fill('Sandi-Baru-77xyz!')
    await card.locator('[data-test=cpw-submit]').click() // tanpa kode
    await expect(card.locator('[data-test=cpw-err]')).toBeVisible()
    await card.locator('[data-test=mf-send]').click()
    await expect(card.locator('[data-test=mf-sent]')).toBeVisible()
    await card.locator('[data-test=mf-code]').fill(lastOtp('email', email))
    await card.locator('[data-test=cpw-submit]').click()
    await expect(card.locator('[data-test=cpw-err]')).toHaveCount(0)
    await expect(card.locator('[data-test=cpw-current]')).toHaveValue('') // form dibersihkan = berhasil
  })
})

// One-off script: logs into the real running dev app and captures real
// screenshots of the admin panel for docs/admin-manual.pdf. Not part of the
// app itself — run manually with the dev servers already up:
//
//   cd frontend && node ../scripts/capture_admin_screenshots.mjs
//
// Requires the temporary "manual_screenshot_admin" account (created via
// Django shell before running this, deleted after) since these are real
// screenshots of real data, not a mock.

import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../docs/screenshots')
mkdirSync(OUT_DIR, { recursive: true })

const BASE_URL = 'http://localhost:5173'

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) })
  console.log(`captured ${name}`)
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  await page.goto(`${BASE_URL}/login`)
  await page.locator('input[type="text"]').fill('manual_screenshot_admin')
  await page.locator('input[type="password"]').fill('ScreenshotTemp123!')
  await page.getByRole('button', { name: 'Вход' }).click()
  await page.waitForURL(`${BASE_URL}/`)

  const acceptCookies = page.getByRole('button', { name: 'Приеми всички' })
  if (await acceptCookies.isVisible().catch(() => false)) {
    await acceptCookies.click()
  }

  await page.goto(`${BASE_URL}/admin`)
  await page.waitForSelector('text=Начало')
  await shot(page, '01-dashboard')

  await page.goto(`${BASE_URL}/admin/products`)
  await page.waitForSelector('table tbody tr')
  await shot(page, '02-products')

  await page.getByRole('button', { name: 'Редактирай' }).first().click()
  await page.getByPlaceholder('Име на продукта').waitFor()
  await shot(page, '02b-product-form')

  await page.goto(`${BASE_URL}/admin/orders`)
  await page.waitForTimeout(800)
  await shot(page, '03-orders')

  await page.goto(`${BASE_URL}/admin/promotions`)
  await page.waitForSelector('text=Промоции')
  await shot(page, '04-promotions')

  await page.goto(`${BASE_URL}/admin/coupons`)
  await page.waitForTimeout(800)
  await shot(page, '05-coupons')

  await page.goto(`${BASE_URL}/admin/customers`)
  await page.waitForTimeout(800)
  await shot(page, '06-customers')

  await page.goto(`${BASE_URL}/admin/chat`)
  await page.waitForTimeout(800)
  await shot(page, '07-chat')

  await browser.close()
  console.log('done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

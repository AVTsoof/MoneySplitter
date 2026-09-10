import { expect, test } from '@playwright/test'

test('publishes an installable web app manifest', async ({ page }) => {
  await page.goto('/')

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestHref).toBeTruthy()

  const manifest = await page.request.get(manifestHref!)
  await expect(manifest).toBeOK()
  expect(await manifest.text()).toContain('MoneySplitter')
})

test('reloads a warmed application while offline', async ({ context, page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Example Italy Trip' })).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker.ready)

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Example Italy Trip' })).toBeVisible()
})

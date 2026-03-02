import { beforeEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { setupCounter } from './counter'

describe('setupCounter', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  test('renders initial count and increments on click', async () => {
    const button = document.createElement('button')
    button.type = 'button'
    document.body.append(button)

    setupCounter(button)

    await expect.element(
      page.getByRole('button', { name: /^count is 0$/i }),
    ).toBeInTheDocument()

    await page.getByRole('button', { name: /^count is 0$/i }).click()

    await expect.element(
      page.getByRole('button', { name: /^count is 1$/i }),
    ).toBeInTheDocument()
  })

  test('exposes an accessible and enabled control for interaction', async () => {
    const button = document.createElement('button')
    button.type = 'button'
    document.body.append(button)

    setupCounter(button)

    const counterButton = page.getByRole('button', { name: /^count is 0$/i })
    await expect.element(counterButton).toBeVisible()
    await expect.element(counterButton).toBeEnabled()
    await expect.element(counterButton).toHaveAccessibleName('count is 0')
  })
})

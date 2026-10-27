const { test, expect } = require('@playwright/test')

async function clickPoint(page, point) {
    // Headless UI intentionally listens to touchend instead of mouse clicks
    // on touch devices. Exercise the real gesture for each browser context.
    if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(point.x, point.y)
    else await page.mouse.click(point.x, point.y)
}

async function clickOutside(page) {
    const point = await page.evaluate(() => {
        // The popup can open above or below and obscure the heading. Choose
        // visible, non-interactive page background, never click through it.
        for (const x of [2, innerWidth - 2]) {
            for (const y of [2, innerHeight / 2, innerHeight - 2]) {
                const target = document.elementFromPoint(x, y)
                if (target && !target.closest('.filter_select, a, button, input, select, textarea')) return { x, y }
            }
        }
        return null
    })
    expect(point).not.toBeNull()
    await clickPoint(page, point)
}

const cases = [
    ...['author', 'title', 'lang', 'about', 'keyword'].map(name => ({
        route: '/sök?avancerad=1', selector: `.${name}_select`, name: `text search ${name}`
    })),
    ...['keywords', 'about-authors', 'narrowing', 'media', 'languages'].map(name => ({
        route: '/bibliotek?avancerat=1', selector: `[data-library-${name}]`, name: `library ${name}`
    })),
    ...['keywords', 'languages'].map(name => ({
        route: '/epub?avancerat=1', selector: `[data-library-${name}]`, name: `EPUB ${name}`
    }))
]

for (const { route, selector, name } of cases) {
    test(`${name}: real options, multiple chips, keyboard and repeated reopening`, async ({ page }) => {
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        expect((await page.goto(route)).status()).toBe(200)
        await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating === false)
        const menu = page.locator(selector)
        const input = menu.getByRole('combobox')
        const chips = menu.locator('.select2-selection__choice')
        const options = menu.locator('.multiselect__element[role="option"]:not([aria-disabled="true"]):not([aria-selected="true"])')
        await expect(input).toBeVisible()
        for (const state of ['true', 'false', 'true']) {
            await input.click()
            await expect(input).toHaveAttribute('aria-expanded', state)
        }
        if (selector.startsWith('[data-library-')) {
            const bounds = await menu.boundingBox()
            const outside = { x: bounds.x + bounds.width + 50, y: bounds.y + 15 }
            if (outside.x < page.viewportSize().width) {
                // This used to be an invisible native-label activation area:
                // Headless UI closed, then the label reopened the same menu.
                for (let attempt = 0; attempt < 3; attempt++) {
                    await clickPoint(page, outside)
                    await expect(input).toHaveAttribute('aria-expanded', 'false')
                }
                await input.click()
                await expect(input).toHaveAttribute('aria-expanded', 'true')
            }
        }
        await expect(options.first()).toBeVisible()
        await options.first().click()
        await expect(chips).toHaveCount(1)
        await expect(input).toHaveAttribute('aria-expanded', 'true')
        await input.press('Escape')
        await expect(input).toHaveAttribute('aria-expanded', 'false')
        await input.click()
        await expect(input).toHaveAttribute('aria-expanded', 'true')
        // Choose two additional, unselected live values using only the keyboard.
        for (let count = 2; count <= 3; count++) {
            await expect(options.first()).toBeVisible()
            await input.press('ArrowDown')
            await expect(input).toHaveAttribute('aria-activedescendant', /.+/)
            // Headless UI schedules keyboard activation on the next animation frame.
            // Wait for each move before sending the next key.
            for (let attempt = 0; attempt < 10; attempt++) {
                const selected = await input.evaluate(el => document.getElementById(el.getAttribute('aria-activedescendant'))?.getAttribute('aria-selected'))
                if (selected === 'false') break
                const previous = await input.getAttribute('aria-activedescendant')
                await input.press('ArrowDown')
                await expect(input).not.toHaveAttribute('aria-activedescendant', previous)
            }
            await expect.poll(() => input.evaluate(el => document.getElementById(el.getAttribute('aria-activedescendant'))?.getAttribute('aria-selected'))).toBe('false')
            await input.press('Enter')
            await expect(chips).toHaveCount(count)
        }
        await expect(options.first()).toBeVisible()
        await input.press('Home')
        await expect(input).toHaveAttribute('aria-activedescendant', /.+/)
        await expect.poll(() => input.evaluate(el => document.getElementById(el.getAttribute('aria-activedescendant')) === document.getElementById(el.getAttribute('aria-controls'))?.querySelector('[role="option"]:not([aria-disabled="true"])'))).toBe(true)
        await input.press('End')
        await expect.poll(() => input.evaluate(el => {
            const active = document.getElementById(el.getAttribute('aria-activedescendant'))
            const options = [...document.getElementById(el.getAttribute('aria-controls')).querySelectorAll('[role="option"]:not([aria-disabled="true"])')]
            return active === options.at(-1)
        })).toBe(true)
        for (const key of ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']) {
            const previous = await input.getAttribute('aria-activedescendant')
            await input.press(key)
            await expect(input).toHaveAttribute('aria-activedescendant', /.+/)
            await expect(input).not.toHaveAttribute('aria-activedescendant', previous)
            await expect(input).toBeFocused()
        }
        await input.press('Escape')
        for (const state of ['true', 'false', 'true', 'false']) {
            await input.click()
            await expect(input).toHaveAttribute('aria-expanded', state)
            await expect(chips).toHaveCount(3)
            const layout = await menu.evaluate(root => {
                const input = root.querySelector('input').getBoundingClientRect()
                const chips = [...root.querySelectorAll('.select2-selection__choice')].map(el => el.getBoundingClientRect())
                return { viewportWidth: window.innerWidth, input: { x: input.x, right: input.right, y: input.y, bottom: input.bottom }, chips: chips.map(r => ({ x: r.x, right: r.right, y: r.y, bottom: r.bottom })) }
            })
            // Chips may wrap below the input, but must never cross to its left
            // on the same line (the reported Library regression).
            for (const chip of layout.chips) {
                expect(chip.x).toBeGreaterThanOrEqual(0)
                expect(chip.right).toBeLessThanOrEqual(layout.viewportWidth + 2)
                if (chip.y < layout.input.bottom - 2 && chip.bottom > layout.input.y + 2) {
                    expect(chip.x).toBeGreaterThanOrEqual(layout.input.right - 2)
                }
            }
        }
        // Headless UI owns dismissal on non-focusable content too.
        for (let attempt = 0; attempt < 3; attempt++) {
            await input.click()
            await expect(input).toHaveAttribute('aria-expanded', 'true')
            await clickOutside(page)
            await expect(input).toHaveAttribute('aria-expanded', 'false')
            await expect(chips).toHaveCount(3)
        }
        await input.click()
        await input.press('ArrowDown')
        await input.press('Tab')
        await expect(input).not.toBeFocused()
        await expect(input).toHaveAttribute('aria-expanded', 'false')
        await expect.poll(() => menu.evaluate(el => el.contains(document.activeElement))).toBe(false)
        await expect(chips).toHaveCount(3)
        await chips.nth(1).getByRole('button').click()
        await expect(chips).toHaveCount(2)
        await input.focus()
        await input.press('Backspace')
        await expect(chips).toHaveCount(1)
        await input.press('Escape')
        await input.click()
        await expect(input).toHaveAttribute('aria-expanded', 'true')
        const label = await options.first().innerText()
        await input.fill(label.trim().slice(0, 6))
        await clickOutside(page)
        await expect(input).toHaveAttribute('aria-expanded', 'false')
        await input.click()
        await expect(input).toHaveAttribute('aria-expanded', 'true')
        await input.fill(label.trim().slice(0, 6))
        await expect(options.first()).toBeVisible()
        await expect(options.first()).toContainText(label.trim().slice(0, 6), { ignoreCase: true })
        await options.first().click()
        await expect(chips).toHaveCount(2)
        await input.press('Escape')
        await input.click()
        await expect(input).toHaveAttribute('aria-expanded', 'true')
        await expect(chips).toHaveCount(2)
        await input.press('Escape')
        expect(errors).toEqual([])
    })
}

test('Library selected categories stay disabled with text-only styling in narrowing', async ({ page }) => {
    await page.goto('/bibliotek?avancerat=1')
    await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating === false)
    const keywords = page.locator('[data-library-keywords]')
    await keywords.getByRole('combobox').click()
    const option = keywords.getByRole('option', { name: 'Brev', exact: true })
    await option.click()
    await keywords.getByRole('combobox').press('Escape')
    const narrowing = page.locator('[data-library-narrowing]')
    await narrowing.getByRole('combobox').click()
    const disabled = narrowing.getByRole('option', { name: 'Brev', exact: true })
    await expect(disabled).toHaveAttribute('aria-disabled', 'true')
    await expect(disabled).toHaveAttribute('aria-selected', 'false')
    await expect(disabled.locator('.multiselect__option')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    const bounds = await disabled.boundingBox()
    expect(bounds).not.toBeNull()
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await expect(narrowing.locator('.select2-selection__choice')).toHaveCount(0)
    await expect(keywords.locator('.select2-selection__choice')).toHaveCount(1)
})

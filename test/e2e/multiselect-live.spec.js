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
    test(`${name}: real options, multiple chips, keyboard and repeated reopening`, async ({ page }, testInfo) => {
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
        if (selector.startsWith('[data-library-')) {
            await expect(input).toBeFocused()
            await expect(menu.locator('.multiselect')).toHaveCSS('outline-style', 'none')
            // The real input is the only painted field frame. A legacy ::before
            // on .multiselect__tags used to paint another full-size border 1.5px
            // lower, visible beneath/right of the input even after outside blur.
            const fieldFrames = () => menu.evaluate(root => {
                const input = root.querySelector('input')
                const field = input.getBoundingClientRect()
                return [...root.querySelectorAll('.multiselect, .multiselect__tags')].flatMap(element => {
                    const style = getComputedStyle(element)
                    const frames = []
                    if (parseFloat(style.borderTopWidth) > 0 || style.boxShadow !== 'none') frames.push(element.className)
                    for (const pseudo of ['::before', '::after']) {
                        const s = getComputedStyle(element, pseudo)
                        if (s.content !== 'none' && s.display !== 'none'
                            && parseFloat(s.width) >= field.width - 2
                            && parseFloat(s.height) >= field.height - 2
                            && (parseFloat(s.borderTopWidth) > 0 || s.boxShadow !== 'none')) {
                            frames.push(`${element.className}${pseudo}`)
                        }
                    }
                    return frames
                })
            })
            expect(await fieldFrames()).toEqual([])
            await expect(input).toHaveCSS('border-top-width', '1px')
            await expect(input).toHaveCSS('border-top-color', 'rgb(122, 20, 0)')
            if (name === 'library keywords') {
                const field = await input.boundingBox()
                const chip = await chips.first().boundingBox()
                const viewport = page.viewportSize()
                await page.screenshot({
                    path: testInfo.outputPath('selected-chip-border.png'),
                    clip: {
                        x: Math.max(0, field.x - 4), y: Math.max(0, field.y - 4),
                        width: Math.min(viewport.width - Math.max(0, field.x - 4), Math.max(field.x + field.width, chip.x + chip.width) - field.x + 8),
                        height: Math.max(field.height, chip.y + chip.height - field.y) + 8
                    }
                })
            }
            await clickOutside(page)
            // WebKit retains input focus after a click on non-focusable page
            // background. Its single keyboard-focus border remains valid.
            await expect.poll(() => input.evaluate(element => {
                const focused = element.matches(':focus-visible')
                return getComputedStyle(element).borderTopColor === (focused ? 'rgb(122, 20, 0)' : 'rgb(153, 153, 153)')
            })).toBe(true)
            expect(await fieldFrames()).toEqual([])
        }
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
            const highlight = await input.evaluate(el => {
                const row = document.getElementById(el.getAttribute('aria-activedescendant'))
                const option = row.querySelector('.multiselect__option')
                const parent = row.getBoundingClientRect(), child = option.getBoundingClientRect()
                return { left: child.left - parent.left, right: parent.right - child.right }
            })
            expect(Math.abs(highlight.left)).toBeLessThan(0.1)
            expect(Math.abs(highlight.right)).toBeLessThan(0.1)
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


test('Library single select matches production and supports reopening, outside click, keyboard and reload', async ({ page }, testInfo) => {
    await page.goto('/bibliotek?avancerat')
    await page.locator('[data-library-mounted="true"]').waitFor()
    const button = page.locator('[data-library-gender]')
    const list = page.locator('.library-gender-options')
    await expect(button).toHaveAccessibleName(/Författarkön/)
    for (let attempt = 0; attempt < 3; attempt++) {
        await button.click()
        await expect(list).toBeVisible()
        await clickOutside(page)
        await expect(list).toHaveCount(0)
    }
    await button.click()
    const buttonBox = await button.boundingBox(), listBox = await list.boundingBox()
    expect(buttonBox.height).toBeCloseTo(31, 1)
    expect(listBox.width).toBeCloseTo(buttonBox.width, 1)
    expect(listBox.x).toBeCloseTo(buttonBox.x, 1)
    expect(listBox.y).toBeCloseTo(buttonBox.y + buttonBox.height - 2, 1)
    await expect(list.getByRole('option').first()).toHaveCSS('padding', '6px')
    await expect(list.getByRole('option').first()).toHaveCSS('font-size', '16px')
    await expect(list.getByRole('option').first()).toHaveCSS('background-color', 'rgb(237, 237, 237)')
    await page.screenshot({
        path: testInfo.outputPath('library-select.png'),
        clip: { x: buttonBox.x, y: buttonBox.y, width: buttonBox.width, height: listBox.y + listBox.height - buttonBox.y }
    })
    await list.press('End')
    await list.press('Enter')
    await expect(button).toHaveAttribute('value', 'male')
    await expect(list).toHaveCount(0)
    await expect(page).toHaveURL(/k%C3%B6n=male/)
    await page.reload()
    await page.locator('[data-library-mounted="true"]').waitFor()
    await expect(button).toHaveAttribute('value', 'male')
    await button.press('Enter')
    await expect(list).toBeVisible()
    await expect(list.getByRole('option', { name: 'Manliga författare', exact: true })).toHaveAttribute('aria-selected', 'true')
    await list.press('Home')
    await list.press('ArrowDown')
    await list.press('Enter')
    await expect(button).toHaveAttribute('value', 'female')
    await button.click()
    await list.press('Escape')
    await expect(button).toBeFocused()
    await button.click()
    await list.getByRole('option', { name: 'Alla författare', exact: true }).click()
    await expect(button).toHaveAttribute('value', '')
    await expect.poll(() => new URL(page.url()).searchParams.has('kön')).toBe(false)
})

test('Library search field and advanced-button gap stay fixed when the clear control appears', async ({ page }, testInfo) => {
    const widths = testInfo.project.name.includes('mobile') ? [390] : [1087, 1440]
    for (const width of widths) {
        await page.setViewportSize({ width, height: 1475 })
        await page.goto('/bibliotek?avancerat=&visa=works&sort=popularitet&title=Giftas')
        await page.locator('[data-library-mounted="true"]').waitFor()
        await page.evaluate(() => document.fonts.ready)
        const input = page.locator('[data-library-filter]')
        const clear = page.locator('[data-library-reset]')
        const geometry = () => page.locator('.main_input').evaluate(row => {
            const box = element => {
                const r = element.getBoundingClientRect()
                return { x: r.x, y: r.y, width: r.width, height: r.height }
            }
            return { input: box(row.querySelector('[data-library-filter]')), advanced: box(row.querySelector('[data-library-advanced]')) }
        })
        await expect(input).toHaveValue('')
        await expect(clear).toBeHidden()
        const empty = await geometry()
        await page.locator('.main_input').screenshot({ path: testInfo.outputPath(`search-controls-${width}-empty.png`) })
        await input.fill('Giftas')
        await expect(clear).toBeVisible()
        await expect.poll(geometry).toEqual(empty)
        await page.locator('.main_input').screenshot({ path: testInfo.outputPath(`search-controls-${width}-active.png`) })
        await clear.focus()
        await clear.press('Enter')
        await expect(input).toHaveValue('')
        await expect(clear).toBeHidden()
        await expect.poll(geometry).toEqual(empty)
        await page.locator('[data-library-gender]').click()
        await page.getByRole('option', { name: 'Kvinnliga författare', exact: true }).click()
        await expect(clear).toBeVisible()
        await expect.poll(geometry).toEqual(empty)
        await clear.focus()
        await clear.press('Enter')
        await expect(clear).toBeHidden()
        await expect.poll(() => new URL(page.url()).searchParams.has('kön')).toBe(false)
        await expect.poll(geometry).toEqual(empty)
    }
})

const config = require('./playwright.nuxt-live.config.js')

// Extended real-data audit. The default Stage deployment gate also runs these
// journeys in Chromium through playwright.nuxt-live.config.js.
module.exports = {
    ...config,
    testMatch: 'multiselect-live.spec.js',
    projects: [
        ...['chromium', 'firefox', 'webkit'].map(browserName => ({
            name: `${browserName}-desktop`,
            use: { browserName, viewport: { width: 1440, height: 1000 } }
        })),
        {
            name: 'chromium-mobile',
            use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
        }
    ]
}

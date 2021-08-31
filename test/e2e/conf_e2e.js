exports.config = {
    // The address of a running selenium server.
    // seleniumAddress: "http://" + (process.env.SELENIUM || "localhost") + ":4444/wd/hub",

    // Capabilities to be passed to the webdriver instance.
    capabilities: {
        browserName: "chrome",
        chromeOptions: {
            args: [
                "--disable-extensions",
                "--window-size=1500,900",
                "--privileged",
                "--headless",
                "--no-sandbox"
            ]
        }
    },

    // Spec patterns are relative to the current working directly when
    // protractor is called.
    specs: ["spec_e2e.js"],

    // chromeOnly: true,

    // Options to be passed to Jasmine-node.
    jasmineNodeOpts: {
        showColors: true,
        defaultTimeoutInterval: 30000
    },
    // directConnect: true,
    // restartBrowserBetweenTests: true,
    framework: "jasmine2",
    // plugins: [{
    //     package: 'protractor-screenshoter-plugin',
    //     screenshotPath: './REPORTS/e2e',
    //     screenshotOnExpect: 'failure+success',
    //     screenshotOnSpec: 'none',
    //     withLogs: 'true',
    //     writeReportFreq: 'asap',
    //     clearFoldersBeforeTest: true
    // }],

    onPrepare: function () {
        // returning the promise makes protractor wait for the reporter config before executing tests
        // return global.browser.getProcessedConfig().then(function(config) {
        // });
    }
}

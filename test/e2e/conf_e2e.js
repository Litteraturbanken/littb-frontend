

var HtmlReporter = require('protractor-html-screenshot-reporter');

exports.config = {
  // The address of a running selenium server.
  seleniumAddress: 'http://localhost:4444/wd/hub',

  // Capabilities to be passed to the webdriver instance.
  capabilities: {
    'browserName': 'chrome'
  },

  // Spec patterns are relative to the current working directly when
  // protractor is called.
  specs: ['spec_e2e.js'],

  // Options to be passed to Jasmine-node.
  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000
  },

  onPrepare: function() {
        jasmine.getEnv().addReporter(new HtmlReporter({
           baseDirectory: 'test/reports',
           takeScreenShotsOnlyForFailedSpecs: true
        }));
     }


};
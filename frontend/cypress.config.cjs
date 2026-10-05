const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    // The first test in each spec pays a cold-start cost: Vite serves the
    // lazily-imported route chunk on demand, so the initial visit + first
    // assertion/request can exceed the 4s/5s defaults. Give them headroom.
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    setupNodeEvents(on) {
      on('task', {
        log(message) {
          console.log(message)
          return null
        },
      })
    },
  },
})

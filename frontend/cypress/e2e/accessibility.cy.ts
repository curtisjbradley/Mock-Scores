/**
 * Accessibility tests using cypress-axe.
 * Runs axe-core against key pages to catch WCAG violations.
 * 
 * These tests inject axe-core into each page and run a full audit.
 * Violations are logged to the Cypress command log with details.
 */

function terminalLog(violations: { id: string; impact: string; description: string; helpUrl: string; nodes: { html: string; failureSummary: string }[] }[]) {
    cy.task('log', `\n${violations.length} accessibility violation(s) detected:`)
    violations.forEach(v => {
        cy.task('log', `  [${v.impact}] ${v.id}: ${v.description}`)
        cy.task('log', `    ${v.helpUrl}`)
        v.nodes.forEach(n => {
            cy.task('log', `    - ${n.html.slice(0, 120)}`)
            cy.task('log', `      ${n.failureSummary}`)
        })
    })
}

describe('Accessibility', () => {
    beforeEach(() => {
        // Stub auth for protected pages
        cy.loginAs({
            userId: 'user-1',
            email: 'test@test.com',
            firstName: 'Test',
            lastName: 'User',
        })
    })

    describe('Public pages', () => {
        it('Login page has no critical a11y violations', () => {
            cy.visit('/login')
            cy.injectAxe()
            cy.checkA11y(null, {
                includedImpacts: ['critical', 'serious'],
                rules: {
                    // Google Sign-In iframe is third-party and not under our control
                    'frame-title': { enabled: false },
                },
            }, terminalLog)
        })

        it('Register page has no critical a11y violations', () => {
            cy.visit('/register')
            cy.injectAxe()
            cy.checkA11y(null, {
                includedImpacts: ['critical', 'serious'],
                rules: {
                    'frame-title': { enabled: false },
                },
            }, terminalLog)
        })

        it('Home page has no critical a11y violations', () => {
            cy.visit('/')
            cy.injectAxe()
            cy.checkA11y(null, {
                includedImpacts: ['critical', 'serious'],
                rules: {
                    'frame-title': { enabled: false },
                },
            }, terminalLog)
        })
    })

    describe('Organizer pages', () => {
        beforeEach(() => {
            // Stub tournament list
            cy.intercept('GET', '/api/organizer/tournament', {
                statusCode: 200,
                body: [{
                    id: 'test-id-000',
                    name: 'Test Tournament',
                    location: 'Test Location',
                    start_date: '2026-01-01',
                    end_date: '2026-01-02',
                    num_teams: 4,
                    num_rounds: 2,
                    status: 'active',
                }],
            })
        })

        it('Organizer home has no critical a11y violations', () => {
            cy.visit('/organizer')
            cy.injectAxe()
            cy.checkA11y(null, {
                includedImpacts: ['critical', 'serious'],
                rules: {
                    'frame-title': { enabled: false },
                },
            }, terminalLog)
        })
    })
})

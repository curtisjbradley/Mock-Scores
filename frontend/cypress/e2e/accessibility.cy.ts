/**
 * Accessibility tests using cypress-axe.
 * Runs axe-core against key pages to catch WCAG violations.
 * 
 * These tests inject axe-core into each page and run a full audit.
 * Violations are logged to the Cypress command log with details.
 */

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
            })
        })

        it('Register page has no critical a11y violations', () => {
            cy.visit('/register')
            cy.injectAxe()
            cy.checkA11y(null, {
                includedImpacts: ['critical', 'serious'],
            })
        })

        it('Home page has no critical a11y violations', () => {
            cy.visit('/')
            cy.injectAxe()
            cy.checkA11y(null, {
                includedImpacts: ['critical', 'serious'],
            })
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
            })
        })
    })
})

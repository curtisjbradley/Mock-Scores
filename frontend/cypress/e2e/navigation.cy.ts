// Tests for ProtectedRoute redirect behaviour and general navigation

const TEST_USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }

describe('Protected routes', () => {
  it('redirects unauthenticated users from /organizer to /login', () => {
    cy.intercept('GET', '/api/auth/session', { statusCode: 401, body: {} }).as('session')
    cy.visit('/organizer')
    cy.url().should('include', '/login')
    cy.url().should('include', encodeURIComponent('/organizer'))
  })

  it('redirects unauthenticated users from /coach to /login', () => {
    cy.intercept('GET', '/api/auth/session', { statusCode: 401, body: {} }).as('session')
    cy.visit('/coach')
    cy.url().should('include', '/login')
    cy.url().should('include', encodeURIComponent('/coach'))
  })

  it('allows authenticated users to access /organizer', () => {
    cy.loginAs(TEST_USER)
    // Stub organizer API calls to avoid real backend
    cy.intercept('GET', '/api/organizer/tournament*', { statusCode: 200, body: [] }).as('orgData')
    cy.visit('/organizer')
    cy.wait('@session')
    cy.url().should('include', '/organizer')
    cy.url().should('not.include', '/login')
  })

  it('allows authenticated users to access /coach', () => {
    cy.loginAs(TEST_USER)
    cy.intercept('GET', '/api/coach*', { statusCode: 200, body: [] }).as('coachData')
    cy.visit('/coach')
    cy.wait('@session')
    cy.url().should('include', '/coach')
    cy.url().should('not.include', '/login')
  })

  it('redirects to /login with correct redirect param for nested organizer route', () => {
    cy.intercept('GET', '/api/auth/session', { statusCode: 401, body: {} }).as('session')
    cy.visit('/organizer/some-tournament-id')
    cy.url().should('include', '/login')
    cy.url().should('include', 'redirect=')
  })
})

describe('404 page', () => {
  it('renders for unknown routes', () => {
    cy.intercept('GET', '/api/auth/session', { statusCode: 401, body: {} }).as('session')
    cy.visit('/this-route-does-not-exist')
    cy.contains(/not found|404/i).should('be.visible')
  })
})

describe('About page', () => {
  it('renders the about page', () => {
    cy.intercept('GET', '/api/auth/session', { statusCode: 401, body: {} }).as('session')
    cy.visit('/about')
    cy.get('main, [class*="about"]').should('exist')
  })
})

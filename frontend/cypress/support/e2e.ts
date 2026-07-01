/**
 * Cypress E2E support file.
 *
 * Custom commands for the new HttpOnly-cookie / in-memory-access-token auth
 * scheme. The old scheme stored a JWT in localStorage; the new scheme stores
 * the access token only in JS module memory and uses an HttpOnly refresh
 * cookie that JS (and therefore Cypress) cannot read directly.
 *
 * loginAs strategy:
 *   1. Stub POST /api/auth/refresh  → 200 { accessToken: 'fake-token' }
 *      When the app boots (or ProtectedRoute mounts), auth.ts calls
 *      refreshAccessToken() which hits this endpoint to hydrate the in-memory
 *      token. This simulates a valid unexpired refresh cookie being present.
 *   2. Stub GET  /api/auth/session  → 200 { ...user }
 *      After the token is set in memory, getSession() verifies it here.
 *
 * No localStorage manipulation is needed or valid under the new model.
 */

Cypress.Commands.add('loginAs', (user: {
  userId: string
  email: string
  firstName: string
  lastName: string
}) => {
  // Stub the silent-refresh endpoint so auth.ts populates _accessToken
  cy.intercept('POST', '/api/auth/refresh', {
    statusCode: 200,
    body: { accessToken: 'fake-access-token' },
  }).as('refresh')

  // Stub the session verification endpoint
  cy.intercept('GET', '/api/auth/session', {
    statusCode: 200,
    body: user,
  }).as('session')
})

/**
 * Simulates logging out: stubs the logout endpoint so the app's logout()
 * call succeeds, and stubs subsequent session/refresh calls as unauthenticated.
 */
Cypress.Commands.add('logout', () => {
  cy.intercept('POST', '/api/auth/logout', { statusCode: 204 }).as('logout')
  cy.intercept('POST', '/api/auth/refresh', { statusCode: 401 }).as('refreshUnauthed')
  cy.intercept('GET', '/api/auth/session', { statusCode: 401, body: {} }).as('sessionUnauthed')
})

declare module 'cypress' {
  interface Chainable {
    loginAs(user: { userId: string; email: string; firstName: string; lastName: string }): void
    logout(): void
  }
}

export {}

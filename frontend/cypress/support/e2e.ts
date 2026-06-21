// Custom command: stub /api/auth/session to simulate a logged-in user
Cypress.Commands.add('loginAs', (user: { userId: string; email: string; firstName: string; lastName: string }) => {
  localStorage.setItem('auth_token', 'fake-token')
  cy.intercept('GET', '/api/auth/session', { statusCode: 200, body: user }).as('session')
})

// Custom command: clear auth state
Cypress.Commands.add('logout', () => {
  localStorage.removeItem('auth_token')
})

declare module 'cypress' {
  interface Chainable {
    loginAs(user: { userId: string; email: string; firstName: string; lastName: string }): void
    logout(): void
  }
}

export {}

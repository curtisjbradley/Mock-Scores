const TEST_USER = { userId: '1', email: 'user@example.com', firstName: 'Jane', lastName: 'Doe' }

describe('Login page', () => {
  beforeEach(() => {
    // Stub refresh as unauthorized so ProtectedRoute doesn't auto-redirect
    cy.intercept('POST', '/api/auth/refresh', { statusCode: 401 }).as('refresh')
    cy.intercept('GET', '/api/auth/session', { statusCode: 401, body: {} }).as('session')
    cy.visit('/login')
  })

  it('renders the sign-in form', () => {
    cy.contains('h1', 'Sign in').should('be.visible')
    cy.get('#email').should('exist')
    cy.get('#password').should('exist')
    cy.contains('button', 'Sign in').should('be.visible')
  })

  it('shows a link to register', () => {
    cy.contains('a', 'Register').should('have.attr', 'href', '/register')
  })

  it('shows validation error for invalid email', () => {
    cy.get('#email').type('notanemail')
    cy.get('#password').type('somepassword')
    cy.contains('button', 'Sign in').click()
    cy.contains('Please enter a valid email address.').should('be.visible')
  })

  it('shows error on failed login', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 401,
      body: { message: 'Invalid email or password.' },
    }).as('loginFail')
    cy.get('#email').type('wrong@example.com')
    cy.get('#password').type('wrongpassword')
    cy.contains('button', 'Sign in').click()
    cy.wait('@loginFail')
    cy.contains('Invalid email or password.').should('be.visible')
  })

  it('redirects to / on successful login', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: { accessToken: 'fake-access-token' },
    }).as('loginOk')
    cy.intercept('GET', '/api/auth/session', { statusCode: 200, body: TEST_USER }).as('sessionOk')
    cy.get('#email').type(TEST_USER.email)
    cy.get('#password').type('correctpassword')
    cy.contains('button', 'Sign in').click()
    cy.wait('@loginOk')
    cy.url().should('eq', Cypress.config('baseUrl') + '/')
  })

  it('redirects to ?redirect target after login', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: { accessToken: 'fake-access-token' },
    }).as('loginOk')
    cy.intercept('GET', '/api/auth/session', { statusCode: 200, body: TEST_USER }).as('sessionOk')
    cy.visit('/login?redirect=%2Forganizer')
    cy.get('#email').type(TEST_USER.email)
    cy.get('#password').type('correctpassword')
    cy.contains('button', 'Sign in').click()
    cy.wait('@loginOk')
    cy.url().should('include', '/organizer')
  })

  it('shows generic error on network failure', () => {
    cy.intercept('POST', '/api/auth/login', { forceNetworkError: true }).as('loginErr')
    cy.get('#email').type(TEST_USER.email)
    cy.get('#password').type('somepassword')
    cy.contains('button', 'Sign in').click()
    cy.contains('Something went wrong. Please try again.').should('be.visible')
  })

  it('already-authed user visiting /login still sees the form (no redirect away)', () => {
    cy.loginAs(TEST_USER)
    cy.visit('/login')
    cy.contains('h1', 'Sign in').should('be.visible')
  })
})

describe('Register page', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/auth/session', { statusCode: 401, body: {} }).as('session')
    cy.visit('/register')
  })

  it('renders the registration form', () => {
    cy.contains('h1', 'Create account').should('be.visible')
    cy.get('#firstName').should('exist')
    cy.get('#lastName').should('exist')
    cy.get('#email').should('exist')
    cy.get('#password').should('exist')
    cy.get('#confirm').should('exist')
    cy.contains('button', 'Create account').should('be.visible')
  })

  it('shows a link to sign in', () => {
    cy.contains('a', 'Sign in').should('have.attr', 'href', '/login')
  })

  it('shows error for invalid email', () => {
    cy.get('#firstName').type('Jane')
    cy.get('#lastName').type('Doe')
    cy.get('#email').type('bademail')
    cy.get('#password').type('password123')
    cy.get('#confirm').type('password123')
    cy.contains('button', 'Create account').click()
    cy.contains('Please enter a valid email address.').should('be.visible')
  })

  it('shows error when passwords do not match', () => {
    cy.get('#firstName').type('Jane')
    cy.get('#lastName').type('Doe')
    cy.get('#email').type('jane@example.com')
    cy.get('#password').type('password123')
    cy.get('#confirm').type('different456')
    cy.contains('button', 'Create account').click()
    cy.contains('Passwords do not match.').should('be.visible')
  })

  it('shows error on registration failure', () => {
    cy.intercept('POST', '/api/auth/register', {
      statusCode: 409,
      body: { message: 'Email already in use.' },
    }).as('registerFail')
    cy.get('#firstName').type('Jane')
    cy.get('#lastName').type('Doe')
    cy.get('#email').type('jane@example.com')
    cy.get('#password').type('Password123')
    cy.get('#confirm').type('Password123')
    cy.contains('button', 'Create account').click()
    cy.wait('@registerFail')
    cy.contains('Email already in use.').should('be.visible')
  })

  it('redirects to /login on successful registration', () => {
    cy.intercept('POST', '/api/auth/register', { statusCode: 201, body: {} }).as('registerOk')
    cy.get('#firstName').type('Jane')
    cy.get('#lastName').type('Doe')
    cy.get('#email').type('newuser@example.com')
    cy.get('#password').type('Password123')
    cy.get('#confirm').type('Password123')
    cy.contains('button', 'Create account').click()
    cy.wait('@registerOk')
    cy.url().should('include', '/login')
  })

  it('shows generic error on network failure', () => {
    cy.intercept('POST', '/api/auth/register', { forceNetworkError: true }).as('registerErr')
    cy.get('#firstName').type('Jane')
    cy.get('#lastName').type('Doe')
    cy.get('#email').type('jane@example.com')
    cy.get('#password').type('Password123')
    cy.get('#confirm').type('Password123')
    cy.contains('button', 'Create account').click()
    cy.contains('Something went wrong. Please try again.').should('be.visible')
  })
})

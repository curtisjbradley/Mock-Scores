describe('Home page', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/auth/session', { statusCode: 401, body: {} }).as('session')
    cy.visit('/')
  })

  it('renders the welcome heading and role buttons', () => {
    cy.contains('h1', 'Welcome').should('be.visible')
    cy.contains('button', 'Organizer').should('be.visible')
    cy.contains('button', 'Coach').should('be.visible')
    cy.contains('button', 'Scorer').should('be.visible')
  })

  it('Organizer button navigates to /organizer (redirects unauthed to login)', () => {
    cy.contains('button', 'Organizer').click()
    cy.url().should('include', '/login')
    cy.url().should('include', 'redirect=')
  })

  it('Coach button navigates to /coach (redirects unauthed to login)', () => {
    cy.contains('button', 'Coach').click()
    cy.url().should('include', '/login')
    cy.url().should('include', 'redirect=')
  })

  it('displays the hero image', () => {
    cy.get('img.home-hero-img').should('exist')
  })

  it('shows logo link in header', () => {
    cy.get('header').contains('MockScores').should('be.visible')
  })

  it('logo link navigates to home', () => {
    cy.get('header a').contains('MockScores').click()
    cy.url().should('eq', Cypress.config('baseUrl') + '/')
  })

  it('shows account info in header when logged in', () => {
    cy.loginAs({ userId: '1', email: 'test@example.com', firstName: 'Jane', lastName: 'Doe' })
    cy.visit('/')
    cy.wait('@session')
    cy.get('header').contains('Jane').should('be.visible')
  })

  it('account button navigates to /account when logged in', () => {
    cy.loginAs({ userId: '1', email: 'test@example.com', firstName: 'Jane', lastName: 'Doe' })
    cy.visit('/')
    cy.wait('@session')
    cy.get('header a[href="/account"]').click()
    cy.url().should('include', '/account')
  })
})

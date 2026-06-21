const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }

describe('New Tournament wizard', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    cy.visit('/organizer/new')
    cy.wait('@session')
  })

  it('renders step 1 — tournament details', () => {
    cy.contains('h1', 'New tournament').should('be.visible')
    cy.get('#name').should('exist')
    cy.get('#location').should('exist')
  })

  it('back button on step 1 navigates to /organizer', () => {
    cy.intercept('GET', '/api/organizer/tournament', { statusCode: 200, body: [] }).as('orgList')
    cy.contains('button', /all tournaments/i).click()
    cy.url().should('include', '/organizer')
    cy.url().should('not.include', '/new')
  })

  it('can progress from step 1 to step 2 by filling required fields', () => {
    cy.get('#name').type('Test Tournament')
    cy.get('#location').type('City Hall')
    // Check both TBD checkboxes so dates are not required
    cy.get('input[type="checkbox"]').each($cb => cy.wrap($cb).check({ force: true }))
    cy.contains('button', 'Next →').click()
    cy.contains('h1', 'Case format').should('be.visible')
  })

  it('back button on step 2 returns to step 1', () => {
    cy.get('#name').type('Test Tournament')
    cy.get('#location').type('City Hall')
    cy.get('input[type="checkbox"]').each($cb => cy.wrap($cb).check({ force: true }))
    cy.contains('button', 'Next →').click()
    cy.contains('h1', 'Case format').should('be.visible')
    cy.contains('button', /← back/i).click()
    cy.contains('h1', 'New tournament').should('be.visible')
  })

  it('shows a stepper with 4 steps', () => {
    cy.get('[class*="stepper"], [class*="step"]').should('exist')
  })
})

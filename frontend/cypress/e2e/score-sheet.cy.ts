// The score sheet route lives outside the main Layout at /score/:scorerID.
// It currently renders EXAMPLE_TRIAL_DETAILS (no real API call yet),
// so tests work without a backend.

describe('Score sheet page', () => {
  const SCORER_ID = 'test-scorer-123'
  const URL = `/score/${SCORER_ID}`

  it('renders the conflict check screen first', () => {
    cy.visit(URL)
    cy.contains('h1', 'Before You Begin').should('be.visible')
  })

  it('displays scorer and trial details on conflict check', () => {
    cy.visit(URL)
    // EXAMPLE_TRIAL_DETAILS values
    cy.contains('dd', 'Bary Allen').should('be.visible')   // scorerName
    cy.contains('dd', 'John Doe').should('be.visible')     // presiderName
    cy.contains('dd', 'Department 10').should('be.visible') // courtroom
    cy.contains('dd', '103').should('be.visible')          // prosecution team
    cy.contains('dd', '101').should('be.visible')          // defense team
  })

  it('labels the teams as Prosecution and Defense for a criminal case', () => {
    cy.visit(URL)
    cy.contains('dt', 'Prosecution Team').should('be.visible')
    cy.contains('dt', 'Defense Team').should('be.visible')
  })

  it('has a Proceed button and a Report Conflict button', () => {
    cy.visit(URL)
    cy.contains('button', 'Proceed').should('be.visible')
    cy.contains('button', 'Report Conflict').should('be.visible')
  })

  it('advances to the score sheet after clicking Proceed', () => {
    cy.visit(URL)
    cy.contains('button', 'Proceed').click()
    // Conflict check should be gone
    cy.contains('h1', 'Before You Begin').should('not.exist')
  })

  it('does not show the main layout header', () => {
    cy.visit(URL)
    // The score route is outside <Layout>, so no site header
    cy.get('header.site-header').should('not.exist')
  })

  it('shows NotFound for a route without a scorerID segment', () => {
    // /score with no trailing segment doesn't match /score/:scorerID → falls to * NotFound
    cy.visit('/score', { failOnStatusCode: false })
    cy.contains(/not found|404/i).should('be.visible')
  })
})

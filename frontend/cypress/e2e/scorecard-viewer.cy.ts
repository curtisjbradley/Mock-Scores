const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }

describe('Scorecard Viewer', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    cy.visit('/organizer/tourney-1/scoresheet/pair-1/judge-1')
    cy.wait('@session')
  })

  it('renders the Scorecard Viewer heading', () => {
    cy.contains('h2', 'Scorecard Viewer').should('be.visible')
  })

  it('displays the tournament, pairing, and judge IDs', () => {
    cy.contains('tourney-1').should('be.visible')
    cy.contains('pair-1').should('be.visible')
    cy.contains('judge-1').should('be.visible')
  })

  it('back button navigates back', () => {
    cy.intercept('GET', '/api/organizer/tournament/tourney-1', { statusCode: 200, body: { id: 'tourney-1', name: 'Spring Invitational', location: '', num_teams: 0, num_rounds: 0, case_format_id: 'cf-1' } }).as('getTournament')
    cy.contains('button', '← Back to tournament').click()
    cy.url().should('not.include', '/scoresheet/')
  })

  it('shows a placeholder note about pending backend integration', () => {
    cy.contains(/Scorecard details will be displayed here/i).should('be.visible')
  })
})

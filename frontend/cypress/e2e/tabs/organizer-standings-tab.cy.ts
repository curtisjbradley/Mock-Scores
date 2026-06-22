const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 0, num_rounds: 0 }

describe('Organizer Standings Tab', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    cy.intercept('GET', '/api/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
    cy.visit('/organizer/tourney-1?page=standings')
    cy.wait('@session')
    cy.wait('@getTournament')
  })

  it('renders the standings table', () => {
    cy.get('.dash-standings-table').should('exist')
  })

  it('shows table headers', () => {
    cy.contains('th', 'Team').should('exist')
    cy.contains('th', 'W').should('exist')
    cy.contains('th', 'L').should('exist')
  })

  it('shows empty table when no standings data', () => {
    cy.get('.dash-standings-table tbody tr').should('not.exist')
  })
})

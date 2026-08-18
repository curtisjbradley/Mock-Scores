const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 2, num_rounds: 1 }
const TEAMS = [
  { id: 'team-1', code: 'A1', name: 'Eagles', coach_email: 'eagles@example.com', has_joined: true, tournament_id: 'tourney-1' },
  { id: 'team-2', code: 'B2', name: 'Hawks', coach_email: 'hawks@example.com', has_joined: false, tournament_id: 'tourney-1' },
]

function stubTeamsTab() {
  cy.intercept('GET', '/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
  cy.intercept('GET', '/organizer/tournament/tourney-1/teams', { statusCode: 200, body: TEAMS }).as('getTeams')
}

describe('Teams Tab', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubTeamsTab()
    cy.visit('/organizer/tourney-1?page=teams')
    cy.wait('@session')
    cy.wait('@getTournament')
    cy.wait('@getTeams')
  })

  it('renders the teams table', () => {
    cy.contains('Eagles').should('be.visible')
    cy.contains('Hawks').should('be.visible')
    cy.contains('A1').should('be.visible')
    cy.contains('eagles@example.com').should('be.visible')
  })

  it('shows accepted/pending status chips', () => {
    cy.contains('accepted').should('be.visible')
    cy.contains('pending').should('be.visible')
  })

  it('opens Add team modal when "+ Add team" is clicked', () => {
    cy.contains('button', '+ Add team').click()
    cy.get('[role="dialog"]').should('be.visible')
  })

  it('closes Add team modal when cancelled', () => {
    cy.contains('button', '+ Add team').click()
    cy.contains('button', /cancel/i).click()
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('opens Remove confirmation when Remove is clicked', () => {
    cy.contains('tr', 'Eagles').contains('button', 'Remove').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains(/remove this team/i).should('be.visible')
  })

  it('removes a team on confirmation', () => {
    cy.intercept('DELETE', '/organizer/tournament/tourney-1/teams', { statusCode: 200, body: {} }).as('deleteTeam')
    cy.contains('tr', 'Eagles').contains('button', 'Remove').click()
    cy.get('[role="dialog"]').within(() => cy.contains('button', /confirm|yes|remove/i).click())
    cy.contains('Eagles').should('not.exist')
  })

  it('shows Edit team modal when Edit is clicked', () => {
    cy.contains('tr', 'Eagles').contains('button', 'Edit').click()
    cy.get('[role="dialog"]').should('be.visible')
  })
})

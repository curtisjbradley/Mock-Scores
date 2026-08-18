const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 0, num_rounds: 0 }
const ROUNDS = [
  { round_id: 'r-1', tournament_id: 'tourney-1', name: 'Round 1', round_time: null, position: 1, teams_public: false, results_public: false },
  { round_id: 'r-2', tournament_id: 'tourney-1', name: 'Round 2', round_time: '2026-03-01T09:00:00Z', position: 2, teams_public: true, results_public: false },
]

function stubRoundsTab(rounds = ROUNDS) {
  cy.intercept('GET', '/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
  cy.intercept('GET', '/organizer/tournament/tourney-1/rounds', { statusCode: 200, body: rounds }).as('getRounds')
}

describe('Rounds Tab', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubRoundsTab()
    cy.visit('/organizer/tourney-1?page=rounds')
    cy.wait('@session')
    cy.wait('@getTournament')
    cy.wait('@getRounds')
    cy.get('.dash-round-summary').should('have.length', 2)
  })

  // Round names render as <input value="Round 1"> not as text nodes
  it('renders round names', () => {
    cy.get('.dash-round-summary').first().find('input.dash-round-name-input').should('have.value', 'Round 1')
    cy.get('.dash-round-summary').eq(1).find('input.dash-round-name-input').should('have.value', 'Round 2')
  })

  it('renders "+ Add round" button', () => {
    cy.contains('button', '+ Add round').should('be.visible')
  })

  it('adds a round on click', () => {
    cy.intercept('POST', '/organizer/tournament/tourney-1/rounds', {
      statusCode: 200,
      body: { round_id: 'r-3', tournament_id: 'tourney-1', name: 'Round 3', round_time: null, position: 3, teams_public: false, results_public: false },
    }).as('postRound')
    cy.contains('button', '+ Add round').click()
    cy.wait('@postRound')
    cy.get('.dash-round-summary').eq(2).find('input.dash-round-name-input').should('have.value', 'Round 3')
  })

  it('clicking Open → navigates to round view', () => {
    cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/r-1', { statusCode: 200, body: ROUNDS[0] }).as('getRound')
    cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/r-1/pairings', { statusCode: 200, body: [] }).as('getPairings')
    cy.intercept('GET', '/organizer/tournament/tourney-1/scorers', { statusCode: 200, body: [] }).as('getScorers')
    cy.intercept('GET', '/organizer/tournament/tourney-1/courtrooms', { statusCode: 200, body: [] }).as('getCourtrooms')
    cy.intercept('GET', '/organizer/tournament/tourney-1/scorer-conflicts', { statusCode: 200, body: [] }).as('getConflicts')
    cy.get('.dash-round-summary').first().contains('button', 'Open →').click()
    cy.url().should('include', '/organizer/tourney-1/round/r-1')
  })

  it('shows remove confirmation when Remove is clicked', () => {
    cy.get('.dash-round-summary').first().contains('button', 'Remove').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains(/remove round 1/i).should('be.visible')
  })

  it('removes round on confirmation', () => {
    cy.intercept('DELETE', '/organizer/tournament/tourney-1/rounds/r-1', { statusCode: 200, body: {} }).as('deleteRound')
    cy.get('.dash-round-summary').first().contains('button', 'Remove').click()
    cy.get('[role="dialog"]').within(() => cy.contains('button', /confirm|yes|remove/i).click())
    cy.get('.dash-round-summary').should('have.length', 1)
  })
})

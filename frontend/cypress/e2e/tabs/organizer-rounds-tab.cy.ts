const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 0, num_rounds: 0 }
const ROUNDS = [
  { round_id: 'r-1', tournament_id: 'tourney-1', name: 'Round 1', round_time: null, position: 1, teams_public: false, results_public: false },
  { round_id: 'r-2', tournament_id: 'tourney-1', name: 'Round 2', round_time: '2026-03-01T09:00:00Z', position: 2, teams_public: true, results_public: false },
]

function failOnUnstubbedOrganizerRequest() {
  // Only guard actual API (xhr/fetch) calls — the SPA document navigation
  // (e.g. GET /organizer/tourney-1?page=rounds) also contains "/organizer/"
  // and must not be treated as an unstubbed API request.
  cy.intercept(
      { url: '**/organizer/**', resourceType: /xhr|fetch/ },
      (req) => {
        throw new Error(
            `Unstubbed API request: ${req.method} ${req.url}`,
        );
      },
  );
}

function stubRoundsTab(rounds = ROUNDS) {
  cy.intercept(
      'GET',
      '/organizer/tournament/tourney-1',
      { statusCode: 200, body: TOURNAMENT },
  ).as('getTournament');

  cy.intercept(
      'GET',
      '/organizer/tournament/tourney-1/rounds',
      { statusCode: 200, body: rounds },
  ).as('getRounds');

  cy.intercept(
      'GET',
      '/organizer/tournament/tourney-1/teams',
      { statusCode: 200, body: [] },
  ).as('getTeams');

  cy.intercept(
      'GET',
      '/organizer/tournament/tourney-1/rounds/*/ballot-status',
      { statusCode: 200, body: [] },
  ).as('getBallotStatus');
}

function stubRoundView() {
  cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/r-1', { statusCode: 200, body: ROUNDS[0] }).as('getRound')
  cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/r-1/pairings', { statusCode: 200, body: [] }).as('getPairings')
  cy.intercept('GET', '/organizer/tournament/tourney-1/scorers', { statusCode: 200, body: [] }).as('getScorers')
  cy.intercept('GET', '/organizer/tournament/tourney-1/courtrooms', { statusCode: 200, body: [] }).as('getCourtrooms')
  cy.intercept('GET', '/organizer/tournament/tourney-1/scorer-conflicts', { statusCode: 200, body: [] }).as('getConflicts')
  cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/r-1/ballot-status', { statusCode: 200, body: [] }).as('getRoundBallotStatus')
  cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/r-1/roster-status', { statusCode: 200, body: [] }).as('getRosterStatus')
}

describe('Rounds Tab', () => {
  beforeEach(() => {
    failOnUnstubbedOrganizerRequest();
    cy.loginAs(USER)
    stubRoundsTab()
    cy.visit('/organizer/tourney-1?page=rounds')
    cy.wait('@session')
    cy.wait('@getTournament')
    cy.wait('@getRounds')
    cy.get('.dash-round-summary').should('have.length', 2)
  })

  // Round names are displayed as headings in the read-only round summaries.
  it('renders round names', () => {
    cy.get('.dash-round-summary').first().find('h3').should('have.text', 'Round 1')
    cy.get('.dash-round-summary').eq(1).find('h3').should('have.text', 'Round 2')
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
    cy.get('.dash-round-summary').eq(2).find('h3').should('have.text', 'Round 3')
  })

  it('clicking a round navigates to its round view', () => {
    cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/r-1', { statusCode: 200, body: ROUNDS[0] }).as('getRound')
    cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/r-1/pairings', { statusCode: 200, body: [] }).as('getPairings')
    cy.intercept('GET', '/organizer/tournament/tourney-1/scorers', { statusCode: 200, body: [] }).as('getScorers')
    cy.intercept('GET', '/organizer/tournament/tourney-1/courtrooms', { statusCode: 200, body: [] }).as('getCourtrooms')
    cy.intercept('GET', '/organizer/tournament/tourney-1/scorer-conflicts', { statusCode: 200, body: [] }).as('getConflicts')
    cy.get('.dash-round-summary').first().click()
    cy.url().should('include', '/organizer/tourney-1/round/r-1')
  })

  it('shows remove confirmation from round actions', () => {
    stubRoundView()
    cy.get('.dash-round-summary').first().click()
    cy.wait('@getRound')
    cy.contains('button', 'Round actions').click()
    cy.contains('button', 'Remove round').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains(/remove round 1/i).should('be.visible')
  })

  it('removes a round from its detail view', () => {
    stubRoundView()
    cy.intercept('DELETE', '/organizer/tournament/tourney-1/rounds/r-1', { statusCode: 200, body: {} }).as('deleteRound')
    cy.get('.dash-round-summary').first().click()
    cy.wait('@getRound')
    cy.contains('button', 'Round actions').click()
    cy.contains('button', 'Remove round').click()
    cy.get('[role="dialog"]').within(() => cy.contains('button', /confirm|yes|remove/i).click())
    cy.wait('@deleteRound')
    cy.url().should('include', '?page=rounds')
  })
})

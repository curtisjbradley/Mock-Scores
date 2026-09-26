const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }

const TOURNAMENT = {
  id: 'tourney-1',
  name: 'Spring Invitational',
  location: 'Downtown Courthouse',
  start_date: '2026-03-01T00:00:00Z',
  end_date: '2026-03-02T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  case_format_id: 'cf-1',
  num_teams: 8,
  num_rounds: 3,
}

function stubDashboard() {
  cy.intercept('GET', '/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
  // stub all tab-level APIs to prevent unhandled requests
  cy.intercept('GET', '/organizer/tournament/tourney-1/teams*', { statusCode: 200, body: [] }).as('getTeams')
  cy.intercept('GET', '/organizer/tournament/tourney-1/scorers*', { statusCode: 200, body: [] }).as('getScorers')
  cy.intercept('GET', '/organizer/tournament/tourney-1/courtrooms*', { statusCode: 200, body: [] }).as('getCourtrooms')
  cy.intercept('GET', '/organizer/tournament/tourney-1/organizers*', { statusCode: 200, body: [] }).as('getOrganizers')
  cy.intercept('GET', '/organizer/tournament/tourney-1/witnesses*', { statusCode: 200, body: [] }).as('getWitnesses')
  cy.intercept('GET', '/organizer/tournament/tourney-1/scoring*', { statusCode: 200, body: [] }).as('getScoring')
  cy.intercept('GET', '/organizer/tournament/tourney-1/rounds*', { statusCode: 200, body: [] }).as('getRounds')
  cy.intercept('GET', '/organizer/tournament/tourney-1/settings*', { statusCode: 200, body: TOURNAMENT }).as('getSettings')
  cy.intercept('GET', '/organizer/tournament/tourney-1/tiebreakers*', { statusCode: 200, body: null }).as('getTiebreakers')
}

describe('Tournament Dashboard', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubDashboard()
    cy.visit('/organizer/tourney-1')
    cy.wait('@session')
    cy.wait('@getTournament')
  })

  it('renders the tournament name and meta', () => {
    cy.contains( 'Spring Invitational').should('be.visible')
    cy.contains('Downtown Courthouse').should('be.visible')
  })

  it('clicking a nav card sets the ?page query param', () => {
    cy.contains('button', 'Teams').click()
    cy.url().should('include', 'page=teams')
  })


  it('Tournament Structure card shows structure sub-cards', () => {
    cy.contains('button', 'Structure').click()
    cy.contains('button', 'Manage Scorecard').should('be.visible')
    cy.contains('button', 'Manage Witnesses').should('be.visible')
    cy.contains('button', 'Manage Tiebreakers').should('be.visible')
  })


  it('navigates to a tab via ?page URL param directly', () => {
    cy.visit('/organizer/tourney-1?page=scorers')
    cy.wait('@getTournament')
    cy.url().should('include', 'page=scorers')
  })

  it('redirects to /403 when the API returns 403', () => {
    cy.intercept('GET', '/organizer/tournament/tourney-1', { statusCode: 403, body: {} }).as('forbidden')
    cy.visit('/organizer/tourney-1')
    cy.wait('@session')
    cy.wait('@forbidden')
    cy.url().should('include', '/403')
  })
})

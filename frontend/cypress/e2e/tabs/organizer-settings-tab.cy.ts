const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 0, num_rounds: 0 }
const ORGANIZERS_OWNER = [{ id: 'o-1', name: 'Alice Smith', email: 'org@example.com', role: 'owner', has_joined: true }]
const ORGANIZERS_DELEGATE = [{ id: 'o-1', name: 'Alice Smith', email: 'org@example.com', role: 'delegate', has_joined: true }]
const FORMAT = { case_name: 'People v. Test', criminal_case: true, p_witnesses_called: null, d_witnesses_called: null, has_swing: false }

function stubSettingsTab(organizers = ORGANIZERS_OWNER) {
  cy.intercept('GET', '/api/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
  cy.intercept('GET', '/api/organizer/tournament/tourney-1/format', { statusCode: 200, body: FORMAT }).as('getFormat')
  cy.intercept('GET', '/api/organizer/tournament/tourney-1/organizers', { statusCode: 200, body: organizers }).as('getOrganizers')
  cy.intercept('GET', '/api/auth/session', { statusCode: 200, body: USER }).as('session')
}

describe('Tournament Settings Tab', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubSettingsTab()
    cy.visit('/organizer/tourney-1?page=tournament')
    cy.wait('@session')
    cy.wait('@getTournament')
  })

  it('renders settings form with pre-populated values', () => {
    cy.get('#name').should('have.value', 'Spring Invitational')
    cy.get('#location').should('have.value', 'Downtown')
    cy.get('#caseName').should('have.value', 'People v. Test')
  })

  it('shows validation error when name is cleared', () => {
    cy.get('#name').clear()
    cy.contains('button', 'Save').click()
    cy.contains('Required').should('be.visible')
  })

  it('saves settings successfully', () => {
    cy.intercept('PATCH', '/api/organizer/tournament/tourney-1', { statusCode: 200, body: {} }).as('saveTournament')
    cy.intercept('PATCH', '/api/organizer/tournament/tourney-1/format', { statusCode: 200, body: {} }).as('saveFormat')
    cy.contains('button', 'Save').click()
    cy.contains('Saved successfully').should('be.visible')
  })

  it('shows danger zone for owner', () => {
    cy.contains('Danger zone').should('be.visible')
    cy.contains('button', 'Delete tournament').should('be.visible')
  })

  it('does not show danger zone for non-owner', () => {
    stubSettingsTab(ORGANIZERS_DELEGATE)
    cy.visit('/organizer/tourney-1?page=tournament')
    cy.wait('@session')
    cy.wait('@getTournament')
    cy.contains('Danger zone').should('not.exist')
  })

  it('opens delete confirmation modal', () => {
    cy.contains('button', 'Delete tournament').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains(/cannot be undone/i).should('be.visible')
  })

  it('cancels delete and stays on page', () => {
    cy.contains('button', 'Delete tournament').click()
    cy.contains('button', /cancel/i).click()
    cy.get('[role="dialog"]').should('not.exist')
    cy.get('#name').should('exist')
  })
})

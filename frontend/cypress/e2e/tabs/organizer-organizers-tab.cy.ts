const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 0, num_rounds: 0 }
const ORGANIZERS = [
  { id: 'o-1', name: 'Alice Smith', email: 'org@example.com', role: 'owner', has_joined: true },
  { id: 'o-2', name: 'Bob Jones', email: 'bob@example.com', role: 'delegate', has_joined: false },
]

function stubOrganizersTab() {
  cy.intercept('GET', '/api/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
  cy.intercept('GET', '/api/organizer/tournament/tourney-1/organizers', { statusCode: 200, body: ORGANIZERS }).as('getOrganizers')
  cy.intercept('GET', '/api/auth/session', { statusCode: 200, body: USER }).as('session')
}

describe('Organizers Tab', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubOrganizersTab()
    cy.visit('/organizer/tourney-1?page=organizers')
    cy.wait('@session')
    cy.wait('@getTournament')
    cy.wait('@getOrganizers')
  })

  it('renders the organizers table', () => {
    cy.contains('Alice Smith').should('be.visible')
    cy.contains('Bob Jones').should('be.visible')
    cy.contains('owner').should('be.visible')
    cy.contains('delegate').should('be.visible')
  })

  it('owner row has no Remove/Edit buttons (read-only)', () => {
    cy.contains('tr', 'Alice Smith').find('button').should('not.exist')
  })

  it('delegate row has Remove button', () => {
    cy.contains('tr', 'Bob Jones').contains('button', 'Remove').should('exist')
  })

  it('delegate row has Edit email button (not joined)', () => {
    cy.contains('tr', 'Bob Jones').contains('button', 'Edit email').should('exist')
  })

  it('opens Add Organizer modal', () => {
    cy.contains('button', '+ Add Organizer').click()
    cy.get('[role="dialog"]').should('be.visible')
  })

  it('closes Add Organizer modal on cancel', () => {
    cy.contains('button', '+ Add Organizer').click()
    cy.contains('button', /cancel/i).click()
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('opens Remove confirmation for delegate', () => {
    cy.contains('tr', 'Bob Jones').contains('button', 'Remove').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains(/remove bob jones/i).should('be.visible')
  })

  it('removes delegate on confirmation', () => {
    cy.intercept('DELETE', '/api/organizer/tournament/tourney-1/organizers', { statusCode: 200, body: {} }).as('deleteOrganizer')
    cy.contains('tr', 'Bob Jones').contains('button', 'Remove').click()
    cy.get('[role="dialog"]').within(() => cy.contains('button', /confirm|yes|remove/i).click())
    cy.contains('Bob Jones').should('not.exist')
  })
})

const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 0, num_rounds: 0 }
const SCORERS = [
  { scorer_id: 's-1', first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
  { scorer_id: 's-2', first_name: 'Bob', last_name: 'Smith', email: 'bob@example.com' },
]

function stubScorersTab() {
  cy.intercept('GET', '/api/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
  cy.intercept('GET', '/api/organizer/tournament/tourney-1/scorers', { statusCode: 200, body: SCORERS }).as('getScorers')
}

describe('Scorers Tab', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubScorersTab()
    cy.visit('/organizer/tourney-1?page=scorers')
    cy.wait('@session')
    cy.wait('@getTournament')
    cy.wait('@getScorers')
  })

  it('renders the scorers table', () => {
    cy.contains('Jane Doe').should('be.visible')
    cy.contains('Bob Smith').should('be.visible')
    cy.contains('jane@example.com').should('be.visible')
  })

  it('opens Add scorer modal', () => {
    cy.contains('button', '+ Add scorer').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('#first-name').should('exist')
    cy.get('#last-name').should('exist')
    cy.get('#scorer-email').should('exist')
  })

  it('submit button disabled when form is empty', () => {
    cy.contains('button', '+ Add scorer').click()
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button', 'Add scorer').should('be.disabled')
    })
    cy.contains('button', 'Cancel').click()
  })

  it('shows invalid email error', () => {
    cy.contains('button', '+ Add scorer').click()
    cy.get('#scorer-email').type('not-an-email')
    cy.contains('Invalid email address').should('be.visible')
  })

  it('closes modal on cancel', () => {
    cy.contains('button', '+ Add scorer').click()
    cy.contains('button', 'Cancel').click()
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('opens Edit scorer modal pre-populated', () => {
    cy.contains('tr', 'Jane Doe').contains('button', 'Edit').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('#first-name').should('have.value', 'Jane')
    cy.get('#last-name').should('have.value', 'Doe')
    cy.get('#scorer-email').should('have.value', 'jane@example.com')
  })

  it('opens Manage Conflicts modal', () => {
    cy.intercept('GET', '/api/organizer/tournament/tourney-1/scorers/s-1/conflicts', { statusCode: 200, body: [] }).as('getConflicts')
    cy.intercept('GET', '/api/organizer/tournament/tourney-1/teams', { statusCode: 200, body: [] }).as('getTeams')
    cy.contains('tr', 'Jane Doe').contains('button', 'Manage Conflicts').click()
    cy.get('[role="dialog"]').contains(/conflicts/i).should('be.visible')
  })

  it('opens remove confirmation and removes scorer', () => {
    cy.intercept('DELETE', '/api/organizer/tournament/tourney-1/scorers', { statusCode: 200, body: {} }).as('deleteScorer')
    cy.contains('tr', 'Jane Doe').contains('button', 'Remove').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('[role="dialog"]').within(() => cy.contains('button', /confirm|yes|remove/i).click())
    cy.contains('Jane Doe').should('not.exist')
  })
})

const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 0, num_rounds: 0 }
const COURTROOMS = [
  { id: 'cr-1', name: 'Courtroom A', location: '2nd Floor' },
  { id: 'cr-2', name: 'Courtroom B', location: null },
]

function stubCourtroomsTab() {
  cy.intercept('GET', '/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
  cy.intercept('GET', '/organizer/tournament/tourney-1/courtrooms', { statusCode: 200, body: COURTROOMS }).as('getCourtrooms')
}

describe('Courtrooms Tab', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubCourtroomsTab()
    cy.visit('/organizer/tourney-1?page=courtrooms')
    cy.wait('@session')
    cy.wait('@getTournament')
    cy.wait('@getCourtrooms')
  })

  it('renders the courtrooms table', () => {
    cy.contains('Courtroom A').should('be.visible')
    cy.contains('2nd Floor').should('be.visible')
    cy.contains('Courtroom B').should('be.visible')
    cy.contains('—').should('be.visible')
  })

  it('opens Add courtroom modal', () => {
    cy.contains('button', '+ Add courtroom').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains('Add courtroom').should('be.visible')
    cy.get('#cr-name').should('exist')
  })

  it('Add button is disabled when name is empty', () => {
    cy.contains('button', '+ Add courtroom').click()
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button', 'Add courtroom').should('be.disabled')
    })
    cy.contains('button', 'Cancel').click()
  })

  it('closes modal on cancel', () => {
    cy.contains('button', '+ Add courtroom').click()
    cy.contains('button', 'Cancel').click()
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('opens Edit modal pre-populated', () => {
    cy.contains('tr', 'Courtroom A').contains('button', 'Edit').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('#cr-name').should('have.value', 'Courtroom A')
    cy.get('#cr-details').should('have.value', '2nd Floor')
  })

  it('adds a courtroom optimistically', () => {
    cy.intercept('POST', '/organizer/tournament/tourney-1/courtrooms', { statusCode: 200, body: {} }).as('postCourtroom')
    cy.contains('button', '+ Add courtroom').click()
    cy.get('#cr-name').type('Courtroom C')
    cy.get('[role="dialog"]').within(() => cy.contains('button', 'Add courtroom').click())
    cy.contains('Courtroom C').should('be.visible')
  })

  it('removes a courtroom after confirmation', () => {
    cy.intercept('DELETE', '/organizer/tournament/tourney-1/courtrooms', { statusCode: 200, body: {} }).as('deleteCourtroom')
    cy.contains('tr', 'Courtroom A').contains('button', 'Remove').click()
    cy.get('[role="dialog"]').within(() => cy.contains('button', /confirm|yes|remove/i).click())
    cy.contains('Courtroom A').should('not.exist')
  })
})

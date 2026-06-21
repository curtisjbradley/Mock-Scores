const USER = { userId: '2', email: 'coach@example.com', firstName: 'Bob', lastName: 'Coach' }

const WITNESSES = [
  { id: 'w-1', name: 'Rio Sacks', side: 'P' },
  { id: 'w-2', name: 'Sam Longo', side: 'P' },
  { id: 'w-3', name: 'Swing Witness', side: 'S' },
]
const FORMAT = { p_witnesses_called: 2, d_witnesses_called: 2 }

describe('Witness Call Order page', () => {
  const URL = '/coach/t-1/witness-order/team-1/p-1?side=p'

  function stubPage(witnesses = WITNESSES, format = FORMAT, saved = []) {
    cy.intercept('GET', '/api/coach/tournaments/t-1/witnesses', { statusCode: 200, body: witnesses }).as('getWitnesses')
    cy.intercept('GET', '/api/coach/tournaments/t-1/format', { statusCode: 200, body: format }).as('getFormat')
    cy.intercept('GET', '/api/coach/teams/team-1/pairings/p-1/witness-order', { statusCode: 200, body: saved }).as('getSaved')
  }

  beforeEach(() => {
    cy.loginAs(USER)
    stubPage()
    cy.visit(URL)
    cy.wait('@session')
    cy.wait('@getWitnesses')
    cy.wait('@getFormat')
    cy.wait('@getSaved')
  })

  it('renders the Witness Call Order heading', () => {
    cy.contains('h1', 'Witness Call Order').should('be.visible')
  })

  it('renders a slot row for each witness called', () => {
    // p_witnesses_called = 2, so 2 rows
    cy.get('tbody tr').should('have.length', 2)
    cy.contains('td', '1').should('be.visible')
    cy.contains('td', '2').should('be.visible')
  })

  it('shows relevant witnesses in each slot select', () => {
    cy.get('select.rv-select').first().within(() => {
      cy.contains('Rio Sacks').should('exist')
      cy.contains('Sam Longo').should('exist')
      cy.contains('Swing Witness (Swing)').should('exist')
    })
  })

  it('can select a witness and save', () => {
    cy.intercept('PUT', '/api/coach/teams/team-1/pairings/p-1/witness-order', { statusCode: 200, body: {} }).as('saveOrder')
    cy.get('select.rv-select').first().select('w-1')
    cy.contains('button', 'Save').click()
    cy.wait('@saveOrder')
  })

  it('cancel navigates back', () => {
    cy.contains('button', 'Cancel').click()
    cy.url().should('not.include', '/witness-order')
  })

  it('shows "No witnesses configured" when witness list is empty', () => {
    cy.loginAs(USER)
    stubPage([], FORMAT)
    cy.visit(URL)
    cy.wait('@session')
    cy.wait('@getWitnesses')
    cy.wait('@getFormat')
    cy.wait('@getSaved')
    cy.contains('No witnesses configured for this tournament.').should('be.visible')
  })

  it('shows "No witness call limit configured" when format has 0 count', () => {
    cy.loginAs(USER)
    stubPage(WITNESSES, { p_witnesses_called: 0, d_witnesses_called: 0 })
    cy.visit(URL)
    cy.wait('@session')
    cy.wait('@getWitnesses')
    cy.wait('@getFormat')
    cy.wait('@getSaved')
    cy.contains('No witness call limit configured for this tournament.').should('be.visible')
  })
})

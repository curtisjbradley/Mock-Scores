const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 2, num_rounds: 2 }

const STANDINGS_PAYLOAD = {
    config: null,   // no standings config — component shows the "configure" message
    teams: [],
    ballots: [],
    rounds: [
        { round_id: 'r-1', name: 'Round 1' },
        { round_id: 'r-2', name: 'Round 2' },
    ],
}

function stubStandingsTab() {
    cy.intercept('GET', '/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
    cy.intercept('GET', '/organizer/tournament/tourney-1/standings', { statusCode: 200, body: STANDINGS_PAYLOAD }).as('getStandings')
}

describe('Organizer Standings Tab', () => {
    beforeEach(() => {
        cy.loginAs(USER)
        stubStandingsTab()
        cy.visit('/organizer/tourney-1?page=standings')
        cy.wait('@session')
        cy.wait('@getTournament')
        cy.wait('@getStandings')
    })

    it('renders round filter checkboxes', () => {
        cy.contains('Filter by round').should('be.visible')
        cy.contains('Round 1').should('be.visible')
        cy.contains('Round 2').should('be.visible')
    })

    it('shows no-config message when standings config is not set', () => {
        cy.contains('No standings configuration set').should('be.visible')
    })

    it('renders the All checkbox', () => {
        cy.get('input[type="checkbox"]').first().should('exist')
    })
})

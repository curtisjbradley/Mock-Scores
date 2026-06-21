import {
    welcomeEmail,
    passwordChangedEmail,
    scorerInviteEmail,
    organizerAddedEmail,
    teamAddedEmail,
    roundResultsPublicEmail,
} from '../../src/email'

describe('welcomeEmail', () => {
    it('includes the first name and a login link', () => {
        const { subject, html, text } = welcomeEmail('Alice')
        expect(subject).toMatch(/welcome/i)
        expect(html).toContain('Alice')
        expect(html).toContain('/login')
        expect(text).toContain('Alice')
    })
})

describe('passwordChangedEmail', () => {
    it('includes the first name and a warning', () => {
        const { subject, html, text } = passwordChangedEmail('Bob')
        expect(subject).toMatch(/password/i)
        expect(html).toContain('Bob')
        expect(text).toContain('Bob')
    })
})

describe('scorerInviteEmail', () => {
    it('includes the tournament name and scorecard URL', () => {
        const { subject, html, text } = scorerInviteEmail('State Championship', 'https://app.example.com/score/123')
        expect(subject).toContain('State Championship')
        expect(html).toContain('State Championship')
        expect(html).toContain('https://app.example.com/score/123')
        expect(text).toContain('https://app.example.com/score/123')
    })
})

describe('organizerAddedEmail', () => {
    it('includes the first name and tournament name', () => {
        const { subject, html, text } = organizerAddedEmail('Carol', 'Regionals 2026')
        expect(subject).toContain('Regionals 2026')
        expect(html).toContain('Carol')
        expect(html).toContain('Regionals 2026')
        expect(text).toContain('Carol')
    })
})

describe('teamAddedEmail', () => {
    it('includes the team name and tournament name', () => {
        const { subject, html, text } = teamAddedEmail('Team Alpha', 'Regionals 2026')
        expect(subject).toContain('Team Alpha')
        expect(html).toContain('Team Alpha')
        expect(html).toContain('Regionals 2026')
        expect(text).toContain('Team Alpha')
    })
})

describe('roundResultsPublicEmail', () => {
    it('includes the round name and standings URL', () => {
        const { subject, html, text } = roundResultsPublicEmail('Regionals 2026', 'Round 2', 'https://app.example.com/standings')
        expect(subject).toContain('Regionals 2026')
        expect(html).toContain('Round 2')
        expect(html).toContain('https://app.example.com/standings')
        expect(text).toContain('https://app.example.com/standings')
    })
})

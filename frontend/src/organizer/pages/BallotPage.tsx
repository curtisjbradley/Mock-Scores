import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../auth/auth'
import type { IScoreSheetFormat } from '@mock-scores/shared'
import { BALLOT_STYLES, buildBallotInner, fitBallotFontSize, type BallotMeta } from '../utils/ballotPdf'
import '../styles/ballot.css'

/**
 * Full-page printable ballot rendered as a real browser route
 * (`/organizer/:id/round/:round/ballot/:pairingId`).
 *
 * Replaces the previous popup + `document.write()` approach. Fetches the
 * scoresheet format for the pairing and renders the shared ballot markup with
 * {@link BALLOT_STYLES}. Round name/time and the courtroom display name are
 * passed via query params so the route is self-contained and shareable.
 */
const BallotPage = () => {
    const { id, round: roundId, pairingId } = useParams<{ id: string; round: string; pairingId: string }>()
    const [params] = useSearchParams()

    const [fmt, setFmt] = useState<IScoreSheetFormat | null>(null)
    const [error, setError] = useState<string | null>(null)
    const sheetRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!id || !roundId || !pairingId) return
        apiFetch(`/organizer/tournament/${id}/rounds/${roundId}/pairings/${pairingId}/ballot-format`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to load ballot')
                return r.json() as Promise<IScoreSheetFormat>
            })
            .then(setFmt)
            .catch(() => setError('Could not load the ballot.'))
    }, [id, roundId, pairingId])

    useEffect(() => {
        if (fmt) document.title = `Ballot — ${fmt.prosecutionCode} v. ${fmt.defenseCode}`
    }, [fmt])

    const meta: BallotMeta = useMemo(() => ({
        courtroom: params.get('courtroom') ?? undefined,
        roundName: params.get('roundName') ?? undefined,
        roundTime: params.get('roundTime'),
    }), [params])

    const innerHtml = useMemo(
        () => (fmt ? buildBallotInner(fmt, meta) : ''),
        [fmt, meta],
    )

    // Scale the ballot so its text is as large as possible while still fitting
    // on a single printable page. Runs before paint to avoid a visible reflow,
    // and re-runs whenever the rendered content changes.
    useLayoutEffect(() => {
        const sheet = sheetRef.current
        if (!sheet || !innerHtml) return
        const fontPx = fitBallotFontSize(innerHtml)
        sheet.style.setProperty('--ballot-font', `${fontPx}px`)
    }, [innerHtml])

    if (error) {
        return (
            <main className="ballot-page">
                <p className="ballot-page-error">{error}</p>
            </main>
        )
    }

    if (!fmt) {
        return (
            <main className="ballot-page">
                <p className="ballot-page-loading">Loading ballot…</p>
            </main>
        )
    }

    return (
        <main className="ballot-page">
            <style>{BALLOT_STYLES}</style>
            <div className="ballot-print-bar">
                <button onClick={() => window.print()}>Print / Save as PDF</button>
            </div>
            <div
                className="ballot-sheet"
                ref={sheetRef}
                dangerouslySetInnerHTML={{ __html: innerHtml }}
            />
        </main>
    )
}

export default BallotPage

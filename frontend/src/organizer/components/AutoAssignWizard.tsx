import { useEffect, useMemo, useState } from 'react'
import type { IPairing, IPairingScorer, IScorer, ITeam, AutoAssignResult } from '@mock-scores/shared'
import { autoAssignScorers } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import '../styles/auto-assign.css'

interface Props {
    tournamentId: string
    pairings: IPairing[]
    teams: ITeam[]
    scorers: IScorer[]
    /** Current assignments per pairing (used to detect locked/submitted + overwrite). */
    pairingScorers: Record<string, IPairingScorer[]>
    /** `${scorer_id}:${team_id}` conflict keys (same shape useRoundView builds). */
    conflictSet: Set<string>
    onClose: () => void
    /** Called after assignments are written so the parent can refresh. */
    onApplied: () => void
}

type WizardStep = 'settings' | 'preview'

/**
 * Guided auto-assignment of scorers across all pairings in a round.
 *
 * Step 1 (settings): pick available scorers, scorers-per-pairing, and the
 * "avoid repeat matchups" toggle.
 * Step 2 (preview): shows the proposed panels (computed client-side by the pure
 * `autoAssignScorers` algorithm), warns about overwriting existing assignments,
 * and writes everything on confirm. The presider is intentionally left unset.
 */
export default function AutoAssignWizard({
    tournamentId, pairings, teams, scorers, pairingScorers, conflictSet, onClose, onApplied,
}: Props) {
    const [step, setStep] = useState<WizardStep>('settings')
    const [availableIds, setAvailableIds] = useState<Set<string>>(() => new Set(scorers.map(s => s.scorer_id)))
    const [perPairing, setPerPairing] = useState(2)
    const [avoidRepeats, setAvoidRepeats] = useState(true)
    const [history, setHistory] = useState<Set<string>>(new Set())
    const [applying, setApplying] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Load prior-round history (which teams each scorer has already seen).
    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/scorer-history`)
            .then(r => r.ok ? r.json() : [])
            .then((rows: { scorer_id: string; team_id: string }[]) =>
                setHistory(new Set(rows.map(h => `${h.scorer_id}:${h.team_id}`))))
            .catch(() => {})
    }, [tournamentId])

    const teamName = (id: string) => teams.find(t => t.id === id)?.code ?? teams.find(t => t.id === id)?.name ?? '—'
    const scorerSeenCount = (id: string) => [...history].filter(h => h.startsWith(`${id}:`)).length

    const toggleAvailable = (id: string) => setAvailableIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
    })

    // A scorer assignment is "locked" (cannot be overwritten) once a ballot has
    // been submitted for it. Those count toward the per-pairing target.
    const isLocked = (s: IPairingScorer) => s.p_points != null && s.d_points != null
    const lockedCount = (pairingId: string) => (pairingScorers[pairingId] ?? []).filter(isLocked).length

    // How many existing (non-locked) assignments the run would REMOVE on apply.
    const overwriteCount = useMemo(() =>
        pairings.reduce((sum, p) => sum + (pairingScorers[p.pairing_id] ?? []).filter(s => !isLocked(s)).length, 0),
    [pairings, pairingScorers])

    const available = scorers.filter(s => availableIds.has(s.scorer_id))

    const capacity = available.length
    const slotsNeeded = pairings.reduce((sum, p) => sum + Math.max(0, perPairing - lockedCount(p.pairing_id)), 0)

    // Preview is computed purely from the current settings (no writes yet).
    const preview: AutoAssignResult | null = useMemo(() => {
        if (step !== 'preview') return null
        return autoAssignScorers({
            pairings: pairings.map(p => ({ pairing_id: p.pairing_id, p_team: p.p_team, d_team: p.d_team, lockedCount: lockedCount(p.pairing_id) })),
            availableScorers: available.map(s => ({ scorer_id: s.scorer_id, name: s.name, is_paper: s.is_paper, prefers_to_score_with: s.prefers_to_score_with })),
            scorersPerPairing: perPairing,
            conflicts: conflictSet,
            history,
            avoidRepeats,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, pairings, available, perPairing, conflictSet, history, avoidRepeats])

    const matchupLabel = (p: IPairing) => `${teamName(p.p_team)} v. ${teamName(p.d_team)}`

    /**
     * Applies the previewed assignment: removes existing non-locked assignments on
     * every touched pairing, then creates each proposed assignment. Presider is
     * left unset. Writes sequentially per pairing to keep ordering deterministic.
     */
    const apply = async () => {
        if (!preview) return
        setApplying(true)
        setError(null)
        try {
            for (const p of preview.pairings) {
                if (p.assigned.length === 0) continue
                // Remove existing non-locked assignments on this pairing first.
                const existing = pairingScorers[p.pairing_id] ?? []
                for (const s of existing) {
                    if (!isLocked(s)) {
                        await apiFetch(`/organizer/tournament/${tournamentId}/pairings/${p.pairing_id}/scorers/${s.assignment_id}`, { method: 'DELETE' })
                    }
                }
                // Create the proposed assignments.
                for (const a of p.assigned) {
                    await apiFetch(`/organizer/tournament/${tournamentId}/pairings/${p.pairing_id}/scorers`, {
                        method: 'POST', body: JSON.stringify({ scorer_id: a.scorer_id }),
                    })
                }
            }
            onApplied()
            onClose()
        } catch {
            setError('Something went wrong while assigning scorers. Some assignments may have been applied.')
            setApplying(false)
        }
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="aa-modal" role="dialog" aria-modal="true" aria-labelledby="aa-title">
                <h2 id="aa-title" className="aa-title">Auto-assign scorers</h2>

                {step === 'settings' && (
                    <div className="aa-step">
                        <div className="aa-settings-row">
                            <label className="aa-field">
                                Scorers per pairing
                                <input
                                    type="number" min={1} className="tc-input aa-num"
                                    value={perPairing}
                                    onChange={e => setPerPairing(Math.max(1, Number(e.target.value) || 1))}
                                />
                            </label>
                            <label className="sc-checkbox-label">
                                <input type="checkbox" checked={avoidRepeats} onChange={e => setAvoidRepeats(e.target.checked)} />
                                Avoid repeat matchups (don't reuse a judge on a team they've already seen)
                            </label>
                        </div>

                        <div className={`aa-capacity ${capacity >= slotsNeeded ? 'aa-capacity--ok' : 'aa-capacity--short'}`}>
                            {capacity} available judge{capacity !== 1 ? 's' : ''} for {slotsNeeded} open slot{slotsNeeded !== 1 ? 's' : ''}
                        </div>

                        <div className="aa-scorer-list">
                            <div className="aa-list-actions">
                                <button type="button" className="pc-cancel-btn" onClick={() => setAvailableIds(new Set(scorers.map(s => s.scorer_id)))}>Select all</button>
                                <button type="button" className="pc-cancel-btn" onClick={() => setAvailableIds(new Set())}>Deselect all</button>
                            </div>
                            {scorers.length === 0 && <p className="sc-conflict-empty">No scorers in this tournament yet.</p>}
                            <ul className="aa-list">
                                {scorers.map(s => (
                                    <li key={s.scorer_id}>
                                        <label className="sc-checkbox-label">
                                            <input type="checkbox" checked={availableIds.has(s.scorer_id)} onChange={() => toggleAvailable(s.scorer_id)} />
                                            {s.name}
                                            <span className={`sc-type-badge ${s.is_paper ? 'sc-type-badge--paper' : 'sc-type-badge--online'}`}>
                                                {s.is_paper ? 'Paper' : 'Online'}
                                            </span>
                                            {s.willing_to_preside && <span className="aa-tag">preside</span>}
                                            <span className="aa-seen">seen {scorerSeenCount(s.scorer_id)}</span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="confirm-actions">
                            <button type="button" onClick={onClose}>Cancel</button>
                            <button type="button" disabled={available.length === 0 || pairings.length === 0} onClick={() => setStep('preview')}>
                                Preview assignment
                            </button>
                        </div>
                    </div>
                )}

                {step === 'preview' && preview && (
                    <div className="aa-step">
                        {overwriteCount > 0 && (
                            <div className="aa-warning" role="alert">
                                ⚠ This will remove {overwriteCount} existing assignment{overwriteCount !== 1 ? 's' : ''} and replace them.
                                Scorers with a submitted ballot are kept and counted toward the target.
                            </div>
                        )}

                        <div className="aa-summary">
                            Proposed: {preview.totalAssigned} assignment{preview.totalAssigned !== 1 ? 's' : ''}
                            {preview.totalUnfilled > 0 && ` · ${preview.totalUnfilled} slot${preview.totalUnfilled !== 1 ? 's' : ''} left empty`}
                            . You can set presiders afterward.
                        </div>

                        <ul className="aa-preview-list">
                            {preview.pairings.map(pr => {
                                const p = pairings.find(x => x.pairing_id === pr.pairing_id)!
                                return (
                                    <li key={pr.pairing_id} className="aa-preview-item">
                                        <div className="aa-preview-matchup">{matchupLabel(p)}</div>
                                        <div className="aa-preview-panel">
                                            {pr.assigned.length === 0 && pr.unfilled === 0
                                                ? <span className="aa-muted">No change</span>
                                                : pr.assigned.map(a => (
                                                    <span key={a.scorer_id} className="aa-chip">
                                                        {a.name}{a.is_paper ? ' (paper)' : ''}
                                                    </span>
                                                ))}
                                            {pr.unfilled > 0 && (
                                                <span className="aa-chip aa-chip--empty" title={pr.unfilledReason ?? ''}>
                                                    {pr.unfilled} unfilled
                                                </span>
                                            )}
                                        </div>
                                        {pr.unfilledReason && <div className="aa-reason">{pr.unfilledReason}</div>}
                                    </li>
                                )
                            })}
                        </ul>

                        {error && <p className="org-error">{error}</p>}

                        <div className="confirm-actions">
                            <button type="button" onClick={() => setStep('settings')} disabled={applying}>Back</button>
                                <button type="button" onClick={apply}>
                                    {applying ? 'Assigning…' : 'Confirm & assign'}
                                </button>

                        </div>
                    </div>
                )}
            </div>
        </ModalBackdrop>
    )
}

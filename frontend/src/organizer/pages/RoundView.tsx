import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/round-view.css'
import '../styles/pairings.css'
import '../../shared/styles/dashboard.css'
import '../../judges/styles/modal.css'
import PairingCard from '../components/PairingCard'
import AddMatchupForm from '../components/AddMatchupForm'
import AutoAssignWizard from '../components/AutoAssignWizard'
import { ConfirmRemoveModal } from '../components/modals'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import AddButton from '../../shared/components/AddButton'
import DangerButton from '../../shared/components/DangerButton'
import StatusChip from '../../shared/components/StatusChip'
import { useRoundView } from '../hooks/useRoundView'
import { usePairingForm } from '../hooks/usePairingForm'
import type { IPairing } from '@mock-scores/shared'
import NotFound from '../../error/NotFound'
import { apiFetch } from '../../auth/auth'
import Tooltip from "../../shared/components/Tooltip"
import ModalBackdrop from '../../shared/components/ModalBackdrop'

const ISSUE_FILTERS = [
    { id: 'missing-courtroom', label: 'No courtroom' },
    { id: 'double-booked-courtroom', label: 'Double-booked courtroom' },
    { id: 'missing-scorers', label: 'No scorers' },
    { id: 'missing-presider', label: 'No presider' },
    { id: 'missing-roster', label: 'No roster' },
    { id: 'missing-call-order', label: 'No call order' },
] as const

type IssueFilter = typeof ISSUE_FILTERS[number]['id']

/**
 * Displays all pairings for a single round and allows the organizer to
 * add/remove matchups and manage scorer assignments.
 *
 * Sub-components:
 * - {@link AddMatchupForm} — team + courtroom selection form
 * - {@link PairingCard} — per-pairing management card
 */
const RoundView = () => {
    const { id, round: roundId } = useParams<{ id: string; round: string }>()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const issueDropdownRef = useRef<HTMLDetailsElement>(null)

    useEffect(() => {
        const closeIssueDropdown = (event: PointerEvent) => {
            const dropdown = issueDropdownRef.current
            if (dropdown?.open && event.target instanceof Node && !dropdown.contains(event.target)) {
                dropdown.open = false
            }
        }
        document.addEventListener('pointerdown', closeIssueDropdown)
        return () => document.removeEventListener('pointerdown', closeIssueDropdown)
    }, [])

    const {
        round, teams, courtrooms, pairings, scorers, pairingScorers, ballotStatus, rosterStatus, conflictSet,
        error, notFound,
        addMatchup, updatePairing, removePairing, setRoundLocked,
        setPairingsPublished, setResultsPublished,
        onScorerAssigned, onScorerCreated, onCourtroomCreated, onScorerRemoved, onPresiderChanged, reloadPairingScorers,
    } = useRoundView(id, roundId)

    const confirmRemove = useConfirmRemove<IPairing>()
    const [sending, setSending] = useState(false)
    const [sendMsg, setSendMsg] = useState<string | null>(null)
    const [linksSent, setLinksSent] = useState(false)
    const [showLockConfirm, setShowLockConfirm] = useState(false)
    const [showAutoAssign, setShowAutoAssign] = useState(false)
    const [showRemoveRound, setShowRemoveRound] = useState(false)
    const [showRoundActions, setShowRoundActions] = useState(false)
    const [showEditRound, setShowEditRound] = useState(false)
    const [roundNameDraft, setRoundNameDraft] = useState('')
    const [roundTimeDraft, setRoundTimeDraft] = useState('')
    const [startTimeTbd, setStartTimeTbd] = useState(false)

    const activeIssues = new Set<IssueFilter>(
        searchParams.getAll('issue')
            .flatMap(value => value.split(','))
            .filter((value): value is IssueFilter => ISSUE_FILTERS.some(filter => filter.id === value)),
    )

    const pairingHasIssue = (pairing: IPairing, issue: IssueFilter) => {
        const assigned = pairingScorers[pairing.pairing_id] ?? []
        const statuses = Object.values(rosterStatus[pairing.pairing_id] ?? {})
        switch (issue) {
            case 'missing-courtroom': return !pairing.courtroom
            case 'double-booked-courtroom': return Boolean(pairing.courtroom && pairings.filter(candidate => candidate.courtroom === pairing.courtroom).length > 1)
            case 'missing-scorers': return assigned.length === 0
            case 'missing-presider': return !assigned.some(scorer => scorer.is_presider)
            case 'missing-roster': return statuses.some(status => status.roster_status === 'none')
            case 'missing-call-order': return statuses.some(status => status.call_order_status === 'none')
        }
    }

    const filteredPairings = activeIssues.size === 0
        ? pairings
        : pairings.filter(pairing => [...activeIssues].some(issue => pairingHasIssue(pairing, issue)))

    const availableIssueFilters = ISSUE_FILTERS.filter(issue =>
        pairings.some(pairing => pairingHasIssue(pairing, issue.id)),
    )

    const setActiveIssues = (issues: Set<IssueFilter>) => {
        const next = new URLSearchParams(searchParams)
        next.delete('issue')
        for (const issue of issues) next.append('issue', issue)
        setSearchParams(next)
    }

    const toggleIssue = (issue: IssueFilter) => {
        const next = new Set(activeIssues)
        if (next.has(issue)) next.delete(issue)
        else next.add(issue)
        setActiveIssues(next)
    }

    const handleSendScoringLinks = () => {
        if (!id || !roundId || sending || linksSent) return
        setSending(true)
        setSendMsg(null)
        apiFetch(`/organizer/tournament/${id}/rounds/${roundId}/send-scoring-links`, { method: 'POST' })
            .then(r => r.ok ? r.json() : null)
            .then((data: { sent: number } | null) => {
                if (data) {
                    setLinksSent(true) // one-time bulk send — hide the button afterwards
                    setSendMsg(`Sent ${data.sent} link${data.sent !== 1 ? 's' : ''}`)
                } else {
                    setSendMsg('Failed to send')
                }
            })
            .catch(() => setSendMsg('Failed to send'))
            .finally(() => setSending(false))
    }


    const {
        showAddForm, addPros, addDef, addCourtroom,
        errors: formErrors, toggleForm, setAddPros, setAddDef,
        setAddCourtroom, reset, submit,
    } = usePairingForm(pairings)

    const handleAddMatchup = () => {
        submit()
        if (!addPros || !addDef || addPros === addDef) return
        if (pairings.some(p => p.p_team === addPros) || pairings.some(p => p.d_team === addDef)) return
        addMatchup(addPros, addDef, addCourtroom, reset)
    }

    // Courtroom IDs assigned to more than one pairing in this round — flagged as double-booked.
    const duplicateCourtrooms = new Set<string>()
    const seenCourtrooms = new Set<string>()
    for (const p of pairings) {
        if (!p.courtroom) continue
        if (seenCourtrooms.has(p.courtroom)) duplicateCourtrooms.add(p.courtroom)
        else seenCourtrooms.add(p.courtroom)
    }

    // Whether the one-time bulk send has already happened — derived from persisted
    // per-scorer email status so the button stays hidden across reloads/other clients,
    // OR from the local flag set right after a successful send this session.
    const linksAlreadySent = linksSent || Object.values(pairingScorers)
        .some(scorers => scorers.some(s => s.email_status != null))
    const scoringLinksNeeded = Object.values(pairingScorers)
        .some(scorers => scorers.some(s => s.type === 'registered'))

    // Publishing/locking gates:
    // - a round can only be locked once its pairings are published
    // - scoring links can only be sent once the round is locked
    // - results can only be published once every expected ballot has been submitted
    const ballotStatuses = pairings.map(p => ballotStatus[p.pairing_id]).filter(Boolean)
    const totalScorers = ballotStatuses.reduce((sum, s) => sum + s.total_scorers, 0)
    const submittedScorers = ballotStatuses.reduce((sum, s) => sum + s.submitted, 0)
    const allBallotsIn = pairings.length > 0 && totalScorers > 0 && submittedScorers === totalScorers


    if (notFound) return <NotFound />

    const removeRound = async () => {
        if (!id || !roundId) return
        const response = await apiFetch(`/organizer/tournament/${id}/rounds/${roundId}`, { method: 'DELETE' })
        if (!response.ok) { setShowRemoveRound(false); return }
        navigate(`/organizer/${id}?page=rounds`)
    }

    const openEditRound = () => {
        if (!round) return
        setRoundNameDraft(round.name)
        setRoundTimeDraft(round.round_time ? new Date(round.round_time).toISOString().slice(0, 16) : '')
        setStartTimeTbd(!round.round_time)
        setShowRoundActions(false)
        setShowEditRound(true)
    }

    const saveRoundDetails = async () => {
        if (!round || !roundNameDraft.trim()) return
        const updated = { ...round, name: roundNameDraft.trim(), round_time: !startTimeTbd && roundTimeDraft ? new Date(roundTimeDraft).toISOString() : null }
        await apiFetch(`/organizer/tournament/${id}/rounds/${roundId}`, { method: 'PATCH', body: JSON.stringify(updated) })
        setShowEditRound(false)
        window.location.reload()
    }

    return (
        <div className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => navigate(`/organizer/${id}?page=rounds`)}>
                     Back to rounds
                </button>

                {error && <p className="org-error">{error}</p>}

                <div className="rv-header">
                    <div className="rv-title-block">
                        <h1 className="rv-name">{round?.name}</h1>
                        {round?.round_time && (
                            <div className="rv-meta-row">
                                <span className="rv-meta">{new Date(round.round_time).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                    <div className="rv-toolbar">
                        <div className="rv-round-actions">
                            <button className="btn-secondary" aria-expanded={showRoundActions} onClick={() => setShowRoundActions(value => !value)}>Round actions</button>
                            {showRoundActions && <div className="rv-round-actions-menu"><button className="btn-secondary" onClick={openEditRound}>Edit round details</button><button className="btn-secondary" onClick={() => { setShowRoundActions(false); setShowAutoAssign(true) }}>Auto-assign scorers</button><DangerButton variant="outline" onClick={() => { setShowRoundActions(false); setShowRemoveRound(true) }}>Remove round</DangerButton></div>}
                        </div>
                        {round?.teams_public
                            ? <Tooltip content={"Coaches can view matchups and start making role assignments."}> <StatusChip label="Pairings published" variant="submitted" /> </Tooltip>
                            : <AddButton
                                className="btn-secondary"
                                disabled={!round || pairings.length === 0}
                                title={pairings.length === 0 ? 'Add at least one pairing before publishing' : 'Publish pairings so teams can see the matchups'}
                                onClick={() => setPairingsPublished(true)}
                              >
                                Publish pairings
                              </AddButton>
                        }

                        {round && (
                            round.locked
                                ? <Tooltip content={"Coaches can no longer make changes to their roster. Scorers can begin to input scores."}> <StatusChip label="Round Locked" variant="submitted" /> </Tooltip>
                                : <AddButton
                                    className="btn-secondary"
                                    disabled={!round.teams_public}
                                    title={!round.teams_public
                                        ? 'Publish pairings before locking the round'
                                        : 'Lock the round to open scoring. This is permanent.'}
                                    onClick={() => setShowLockConfirm(true)}
                                  >
                                    Lock round
                                  </AddButton>
                        )}

                        {round?.locked && scoringLinksNeeded && !linksAlreadySent && (
                            <AddButton
                                onClick={handleSendScoringLinks}
                                disabled={sending}
                                title="Email scoring links to assigned judges. This can only be done once."
                            >
                                {sending ? 'Sending…' : 'Send scoring links'}
                            </AddButton>
                        )}
                        {sendMsg && (
                            <StatusChip
                                label={sendMsg}
                                variant={sendMsg.startsWith('Sent') ? 'submitted' : 'danger'}
                            />
                        )}

                        {round?.results_public
                            ? <StatusChip label="Results published" variant="submitted" />
                            : allBallotsIn && (
                                <AddButton
                                    disabled={!round}
                                    title="Publish results so teams can see scores"
                                    onClick={() => setResultsPublished(true)}
                                >
                                    Publish results
                                </AddButton>
                            )
                        }
                    </div>
                </div>


                <div className="dash-pairings">
                    <div className="rv-pairing-filters">
                        <div className="rv-active-issues" aria-label="Active filters">
                            {ISSUE_FILTERS.filter(issue => activeIssues.has(issue.id)).map(issue => (
                                <button key={issue.id} type="button" className="rv-active-issue" onClick={() => toggleIssue(issue.id)} aria-label={`Remove ${issue.label} filter`}>
                                    <StatusChip label={`${issue.label} x`} variant="danger" />
                                </button>
                            ))}
                        </div>
                        {availableIssueFilters.length > 0 && (
                            <details ref={issueDropdownRef} className="rv-issue-dropdown">
                                <summary aria-label="Filter pairings" title="Filter pairings">
                                    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                                    <span>Filter</span>
                                </summary>
                                <div className="rv-issue-panel">
                                    <fieldset>
                                        <legend>Show pairings with any of these issues</legend>
                                        {availableIssueFilters.map(issue => (
                                            <label key={issue.id} className="rv-issue-option">
                                                <input type="checkbox" checked={activeIssues.has(issue.id)} onChange={() => toggleIssue(issue.id)} />
                                                <span>{issue.label}</span>
                                            </label>
                                        ))}
                                    </fieldset>
                                </div>
                            </details>
                        )}
                    </div>
                    {pairings.length === 0 && !showAddForm && (
                        <div className="rv-generate-section">
                            <p className="rv-empty">No matchups yet. Add them manually.</p>
                        </div>
                    )}
                    {pairings.length > 0 && filteredPairings.length === 0 && <p className="rv-empty">No pairings match the selected issues.</p>}
                    {filteredPairings.map((pairing) => (
                        <PairingCard
                            key={pairing.pairing_id}
                            pairing={pairing}
                            pairingNumber={pairings.indexOf(pairing) + 1}
                            teams={teams}
                            courtrooms={courtrooms}
                            scorers={scorers}
                            assignedScorers={pairingScorers[pairing.pairing_id] ?? []}
                            ballotStatus={ballotStatus[pairing.pairing_id]}
                            rosterStatuses={rosterStatus[pairing.pairing_id] ?? {}}
                            linksSent={linksAlreadySent}
                            tournamentId={id!}
                            roundId={roundId!}
                            round={round}
                            conflictSet={conflictSet}
                            courtroomInUse={!!pairing.courtroom && duplicateCourtrooms.has(pairing.courtroom)}
                            onRemove={() => confirmRemove.open(pairing)}
                            onUpdate={updatePairing}
                            onScorerAssigned={s => onScorerAssigned(pairing.pairing_id, s)}
                            onScorerCreated={onScorerCreated}
                            onCourtroomCreated={onCourtroomCreated}
                            onScorerRemoved={assignmentId => onScorerRemoved(pairing.pairing_id, assignmentId)}
                            onPresiderChanged={(assignmentId, onlyTiebreaker) => onPresiderChanged(pairing.pairing_id, assignmentId, onlyTiebreaker)}
                        />
                    ))}
                </div>
                {showAddForm && (
                    <AddMatchupForm
                        teams={teams}
                        courtrooms={courtrooms}
                        addPros={addPros}
                        addDef={addDef}
                        addCourtroom={addCourtroom}
                        prosError={formErrors.prosError}
                        defError={formErrors.defError}
                        onProsChange={setAddPros}
                        onDefChange={setAddDef}
                        onCourtroomChange={setAddCourtroom}
                        onSubmit={handleAddMatchup}
                    />
                )}
                <div className="rv-bottom-actions">
                    <AddButton className="rv-add-pairing" onClick={toggleForm}>
                        {showAddForm ? 'Cancel' : '+ Add Pairing'}
                    </AddButton>
                </div>

            </div>

            {showAutoAssign && (
                <AutoAssignWizard
                    tournamentId={id!}
                    pairings={pairings}
                    teams={teams}
                    scorers={scorers}
                    pairingScorers={pairingScorers}
                    conflictSet={conflictSet}
                    onClose={() => setShowAutoAssign(false)}
                    onApplied={reloadPairingScorers}
                />
            )}

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message="Remove this pairing?"
                    onCancel={confirmRemove.clear}
                    onConfirm={() => { removePairing(confirmRemove.pending!); confirmRemove.clear() }}
                />
            )}
            {showRemoveRound && (
                <ConfirmRemoveModal
                    message={`Remove ${round?.name ?? 'this round'} and all its matchups?`}
                    onCancel={() => setShowRemoveRound(false)}
                    onConfirm={() => { void removeRound() }}
                />
            )}
            {showEditRound && (
                <ModalBackdrop onClose={() => setShowEditRound(false)}>
                    <div className="confirm-modal rv-edit-round-modal" role="dialog" aria-modal="true" aria-labelledby="edit-round-title">
                        <h2 id="edit-round-title">Edit round details</h2>
                        <form className="rv-edit-round-form" onSubmit={e => { e.preventDefault(); void saveRoundDetails() }}>
                            <div>
                                <label className="modal-label" htmlFor="round-name">Round name</label>
                                <input id="round-name" className="modal-input" value={roundNameDraft} onChange={e => setRoundNameDraft(e.target.value)} />
                            </div>
                            <div>
                                <label className="modal-label" htmlFor="round-time">Start time</label>
                                <input id="round-time" type="datetime-local" className="modal-input" value={roundTimeDraft} disabled={startTimeTbd} onChange={e => { setRoundTimeDraft(e.target.value); setStartTimeTbd(false) }} />
                                <label className="rv-tbd-option">
                                    <input type="checkbox" checked={startTimeTbd} onChange={e => setStartTimeTbd(e.target.checked)} />
                                    Start time is TBD
                                </label>
                                <p className="rv-edit-round-hint">Choose TBD when the round has no confirmed start time. You can set one later.</p>
                            </div>
                            <div className="confirm-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowEditRound(false)}>Cancel</button>
                                <button type="submit" className="btn-confirm" disabled={!roundNameDraft.trim()}>Save changes</button>
                            </div>
                        </form>
                    </div>
                </ModalBackdrop>
            )}

            {showLockConfirm && (
                <ConfirmRemoveModal
                    message="Locking opens scoring for this round and is permanent — the round cannot be unlocked. Coaches can no longer edit call orders or role assignments, and any team that left theirs unset will inherit its saved defaults."
                    confirmLabel="Lock round"
                    onCancel={() => setShowLockConfirm(false)}
                    onConfirm={() => { setRoundLocked(true); setShowLockConfirm(false) }}
                />
            )}


        </div>
    )
}

export default RoundView

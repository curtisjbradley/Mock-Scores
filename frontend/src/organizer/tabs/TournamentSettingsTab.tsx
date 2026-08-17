import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/tournament-create.css'
import Section from './Section'
import type { TournamentInfo, CaseFormatState } from '../types/tournament'
import { apiFetch } from '../../auth/auth'
import { ConfirmRemoveModal } from '../components/modals'
import FormField from '../../shared/components/FormField'
import DateRangePicker from '../../shared/components/DateRangePicker'
import { useTournamentSettings } from '../hooks/useTournamentSettings'

/** Returns the end-date validation error string, or '' when valid. */
function endDateError(info: TournamentInfo): string {
    if (!info.endTbd && !info.endDate) return 'Required'
    if (!info.endTbd && !info.startTbd && info.endDate < info.startDate) return 'Must be after start'
    return ''
}

/** Derives validation errors from the current TournamentInfo + CaseFormatState. */
function getErrors(info: TournamentInfo, cf: CaseFormatState) {
    return {
        name:      !info.name.trim() ? 'Required' : '',
        location:  !info.location.trim() ? 'Required' : '',
        startDate: !info.startTbd && !info.startDate ? 'Required' : '',
        endDate:   endDateError(info),
        caseName:  !cf.caseName.trim() ? 'Required' : '',
    }
}

/**
 * Tournament settings tab in the organizer dashboard.
 * Allows editing tournament details and case format, and deleting the tournament.
 * All state management is handled by {@link useTournamentSettings}.
 */
export default function TournamentSettingsTab({ tournamentId }: { tournamentId: string }) {
    const navigate = useNavigate()
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [currentStatus, setCurrentStatus] = useState<'active' | 'completed' | 'archived'>('active')
    const [statusSaving, setStatusSaving] = useState(false)

    const {
        info, caseFormat, loading, loadError,
        saving, saveError, saveSuccess, submitted, isOwner,
        setInfo, setCaseFormat, setSaveError,
        handleSave,
    } = useTournamentSettings(tournamentId, getErrors)

    // Fetch current status
    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}`)
            .then(r => r.ok ? r.json() : null)
            .then(t => { if (t?.status) setCurrentStatus(t.status) })
            .catch(() => {})
    }, [tournamentId])

    const handleStatusChange = async (newStatus: 'active' | 'completed' | 'archived') => {
        setStatusSaving(true)
        const res = await apiFetch(`/organizer/tournament/${tournamentId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus }),
        })
        if (res.ok) setCurrentStatus(newStatus)
        else setSaveError('Failed to update status.')
        setStatusSaving(false)
    }

    const handleDelete = async () => {
        const res = await apiFetch(`/organizer/tournament/${tournamentId}`, { method: 'DELETE' })
        if (res.ok) navigate('/organizer', { replace: true })
        else { setSaveError('Failed to delete tournament.'); setShowDeleteModal(false) }
    }

    if (loading) return <p className="dash-saving">Loading…</p>

    const errors = getErrors(info, caseFormat)

    return (
        <Section title="Tournament settings">
            {(loadError || saveError) && <div className="tc-error-banner">{loadError ?? saveError}</div>}
            {saveSuccess && <div className="tc-error-banner dash-save-success">Saved successfully</div>}

            <form className="tc-form" onSubmit={handleSave} noValidate>
                <FormField
                    id="name"
                    label="Tournament name"
                    value={info.name}
                    placeholder="e.g. San Luis Obispo County"
                    submitted={submitted}
                    error={errors.name}
                    onChange={e => setInfo({ ...info, name: e.target.value })}
                />

                <FormField
                    id="location"
                    label="Location"
                    value={info.location}
                    placeholder="e.g. SLO Superior Court"
                    submitted={submitted}
                    error={errors.location}
                    onChange={e => setInfo({ ...info, location: e.target.value })}
                />

                <DateRangePicker
                    info={info}
                    submitted={submitted}
                    errors={{ startDate: errors.startDate, endDate: errors.endDate }}
                    onChange={setInfo}
                />

                <FormField
                    id="caseName"
                    label="Case name"
                    value={caseFormat.caseName}
                    placeholder="e.g. People v. Fromholz"
                    submitted={submitted}
                    error={errors.caseName}
                    onChange={e => setCaseFormat({ ...caseFormat, caseName: e.target.value })}
                />

                <label className="tc-checkbox-label">
                    <input
                        type="checkbox"
                        checked={caseFormat.criminalCase}
                        onChange={() => setCaseFormat({ ...caseFormat, criminalCase: !caseFormat.criminalCase })}
                    />
                    Criminal case
                </label>

                <div className="tc-actions">
                    <button type="submit" className="btn-confirm" disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>

            {isOwner && (
                <div className="tc-status-section">
                    <h3>Tournament status</h3>
                    <p style={{ fontSize: '0.9em', color: '#666', marginBottom: 12 }}>
                        Current status: <strong>{currentStatus}</strong>
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {currentStatus !== 'active' && (
                            <button type="button" className="org-new-btn" disabled={statusSaving}
                                onClick={() => handleStatusChange('active')}>
                                Reactivate
                            </button>
                        )}
                        {currentStatus !== 'completed' && (
                            <button type="button" className="org-new-btn" disabled={statusSaving}
                                onClick={() => handleStatusChange('completed')}>
                                Mark completed
                            </button>
                        )}
                        {currentStatus !== 'archived' && (
                            <button type="button" className="org-new-btn" disabled={statusSaving}
                                style={{ background: '#6b7280' }}
                                onClick={() => handleStatusChange('archived')}>
                                Archive
                            </button>
                        )}
                    </div>
                </div>
            )}

            {isOwner && (
                <div className="tc-danger-zone">
                    <h3>Danger zone</h3>
                    <p>Permanently delete this tournament. All configurations and scorecards will become unavailable and cannot be recovered.</p>
                    <button type="button" className="tc-delete-btn" onClick={() => setShowDeleteModal(true)}>
                        Delete tournament
                    </button>
                </div>
            )}

            {showDeleteModal && (
                <ConfirmRemoveModal
                    message="This tournament will no longer be accessible. All existing configurations and scorecards will become permanently unavailable. This cannot be undone."
                    confirmLabel="Delete tournament"
                    onCancel={() => setShowDeleteModal(false)}
                    onConfirm={handleDelete}
                />
            )}
        </Section>
    )
}

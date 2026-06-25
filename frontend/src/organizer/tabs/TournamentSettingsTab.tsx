import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/tournament-create.css'
import Section from './Section'
import { fetchFormat, saveFormat, saveTournamentInfo } from '../hooks/useTournamentData'
import type { TournamentInfo, CaseFormatState } from '../types/tournament'
import { emptyCaseFormat } from '../types/tournament'
import type { ITournament, IOrganizer } from '@mock-scores/shared'
import { apiFetch, getSession } from '../../auth/auth'
import { ConfirmRemoveModal } from '../components/modals'

const emptyInfo: TournamentInfo = { name: '', location: '', startDate: '', endDate: '', startTbd: false, endTbd: false }

function getErrors(info: TournamentInfo, cf: CaseFormatState) {
    return {
        name:      !info.name.trim() ? 'Required' : '',
        location:  !info.location.trim() ? 'Required' : '',
        startDate: !info.startTbd && !info.startDate ? 'Required' : '',
        endDate:   !info.endTbd && !info.endDate ? 'Required'
                 : !info.endTbd && !info.startTbd && info.endDate < info.startDate ? 'Must be after start' : '',
        caseName:  !cf.caseName.trim() ? 'Required' : '',
    }
}

export default function TournamentSettingsTab({ tournamentId }: { tournamentId: string }) {
    const navigate = useNavigate()
    const [info, setInfo] = useState<TournamentInfo>(emptyInfo)
    const [caseFormat, setCaseFormat] = useState<CaseFormatState>(emptyCaseFormat)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [isOwner, setIsOwner] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    useEffect(() => {
        Promise.all([
            apiFetch(`/api/organizer/tournament/${tournamentId}`).then(r => r.ok ? r.json() as Promise<ITournament> : Promise.reject()),
            fetchFormat(tournamentId),
            apiFetch(`/api/organizer/tournament/${tournamentId}/organizers`).then(r => r.ok ? r.json() as Promise<IOrganizer[]> : Promise.resolve([])),
            getSession(),
        ]).then(([t, cf, organizers, session]) => {
            setIsOwner(!!session && organizers.some(o => o.email === session.email && o.role === 'owner'))
            setInfo({
                name: t.name, location: t.location,
                startDate: t.start_date ? String(t.start_date).slice(0, 10) : '',
                endDate: t.end_date ? String(t.end_date).slice(0, 10) : '',
                startTbd: !t.start_date, endTbd: !t.end_date,
            })
            setCaseFormat(cf)
            setLoading(false)
        }).catch(() => { setLoading(false); setError('Failed to load tournament data.') })
    }, [tournamentId])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitted(true)
        if (Object.values(getErrors(info, caseFormat)).some(Boolean)) return
        setSaving(true); setSaveError(null); setSaveSuccess(false)
        try {
            await Promise.all([saveTournamentInfo(tournamentId, info), saveFormat(tournamentId, caseFormat)])
            setSaveSuccess(true)
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        const res = await apiFetch(`/api/organizer/tournament/${tournamentId}`, { method: 'DELETE' })
        if (res.ok) navigate('/organizer', { replace: true })
        else { setSaveError('Failed to delete tournament.'); setShowDeleteModal(false) }
    }

    if (loading) return <p className="dash-saving">Loading…</p>

    const errors = getErrors(info, caseFormat)

    return (
        <Section title="Tournament settings">
            {(error || saveError) && <div className="tc-error-banner">{error ?? saveError}</div>}
            {saveSuccess && <div className="tc-error-banner dash-save-success">Saved successfully</div>}
            <form className="tc-form" onSubmit={handleSave} noValidate>
                <div className="tc-field">
                    <label className="tc-label" htmlFor="name">Tournament name</label>
                    <input id="name" type="text"
                        className={`tc-input${submitted && errors.name ? ' tc-input--invalid' : ''}`}
                        value={info.name} placeholder="e.g. San Luis Obispo County"
                        onChange={e => setInfo({ ...info, name: e.target.value })} />
                    {submitted && errors.name && <span className="tc-field-error">{errors.name}</span>}
                </div>

                <div className="tc-field">
                    <label className="tc-label" htmlFor="location">Location</label>
                    <input id="location" type="text"
                        className={`tc-input${submitted && errors.location ? ' tc-input--invalid' : ''}`}
                        value={info.location} placeholder="e.g. SLO Superior Court"
                        onChange={e => setInfo({ ...info, location: e.target.value })} />
                    {submitted && errors.location && <span className="tc-field-error">{errors.location}</span>}
                </div>

                <div className="tc-section">
                    <span className="tc-section-label">Dates</span>
                    <div className="tc-row">
                        {(['startDate', 'endDate'] as const).map(key => {
                            const tbdKey = key === 'startDate' ? 'startTbd' : 'endTbd'
                            return (
                                <div key={key} className="tc-field">
                                    <label className="tc-label">{key === 'startDate' ? 'Start' : 'End'}</label>
                                    {!info[tbdKey] && (
                                        <input type="date"
                                            className={`tc-input${submitted && errors[key] ? ' tc-input--invalid' : ''}`}
                                            value={info[key]} onChange={e => setInfo({ ...info, [key]: e.target.value })} />
                                    )}
                                    <label className="tc-checkbox-label">
                                        <input type="checkbox" checked={info[tbdKey]}
                                            onChange={() => setInfo({ ...info, [tbdKey]: !info[tbdKey] })} />
                                        TBD
                                    </label>
                                    {submitted && errors[key] && <span className="tc-field-error">{errors[key]}</span>}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="tc-field">
                    <label className="tc-label" htmlFor="caseName">Case name</label>
                    <input id="caseName" type="text"
                        className={`tc-input${submitted && errors.caseName ? ' tc-input--invalid' : ''}`}
                        value={caseFormat.caseName} placeholder="e.g. People v. Fromholz"
                        onChange={e => setCaseFormat({ ...caseFormat, caseName: e.target.value })} />
                    {submitted && errors.caseName && <span className="tc-field-error">{errors.caseName}</span>}
                </div>

                <label className="tc-checkbox-label">
                    <input type="checkbox" checked={caseFormat.criminalCase}
                        onChange={() => setCaseFormat({ ...caseFormat, criminalCase: !caseFormat.criminalCase })} />
                    Criminal case
                </label>

                <div className="tc-actions">
                    <button type="submit" className="btn-confirm" disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>

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

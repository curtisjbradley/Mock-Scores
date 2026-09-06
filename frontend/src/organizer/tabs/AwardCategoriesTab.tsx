import { useEffect, useState } from 'react'
import { apiFetch } from '../../auth/auth'
import type { IIndividualAwardCategory } from '@mock-scores/shared'
import Section from './Section'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import { ConfirmRemoveModal } from '../components/modals'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import DangerButton from '../../shared/components/DangerButton'
import AddButton from '../../shared/components/AddButton'

interface Props {
    tournamentId: string
}

export default function AwardCategoriesTab({ tournamentId }: Props) {
    const [categories, setCategories] = useState<IIndividualAwardCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [minNominees, setMinNominees] = useState(1)
    const [maxNominees, setMaxNominees] = useState(3)
    const [formError, setFormError] = useState<string | null>(null)
    const confirmRemove = useConfirmRemove<IIndividualAwardCategory>()

    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/award-categories`)
            .then(r => { if (!r.ok) throw new Error(); return r.json() })
            .then(setCategories)
            .catch(() => setError('Failed to load award categories.'))
            .finally(() => setLoading(false))
    }, [tournamentId])

    const openAddModal = () => {
        setEditingId(null)
        setName('')
        setMinNominees(1)
        setMaxNominees(3)
        setFormError(null)
        setShowModal(true)
    }

    const openEditModal = (cat: IIndividualAwardCategory) => {
        setEditingId(cat.id)
        setName(cat.name)
        setMinNominees(cat.minNominees)
        setMaxNominees(cat.maxNominees)
        setFormError(null)
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!name.trim()) { setFormError('Name is required'); return }
        if (minNominees < 0) { setFormError('Min nominees must be ≥ 0'); return }
        if (maxNominees < 1) { setFormError('Max nominees must be ≥ 1'); return }
        if (minNominees > maxNominees) { setFormError('Min cannot exceed max'); return }

        try {
            if (editingId) {
                const r = await apiFetch(`/organizer/tournament/${tournamentId}/award-categories/${editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name: name.trim(), minNominees, maxNominees }),
                })
                if (!r.ok) throw new Error()
                const updated: IIndividualAwardCategory = await r.json()
                setCategories(prev => prev.map(c => c.id === updated.id ? updated : c))
            } else {
                const r = await apiFetch(`/organizer/tournament/${tournamentId}/award-categories`, {
                    method: 'POST',
                    body: JSON.stringify({ name: name.trim(), minNominees, maxNominees }),
                })
                if (!r.ok) throw new Error()
                const created: IIndividualAwardCategory = await r.json()
                setCategories(prev => [...prev, created])
            }
            setShowModal(false)
        } catch {
            setFormError('Failed to save award category.')
        }
    }

    const handleDelete = (cat: IIndividualAwardCategory) => {
        apiFetch(`/organizer/tournament/${tournamentId}/award-categories/${cat.id}`, { method: 'DELETE' })
            .then(r => { if (!r.ok && r.status !== 204) throw new Error() })
            .catch(console.error)
        setCategories(prev => prev.filter(c => c.id !== cat.id))
        confirmRemove.clear()
    }

    if (loading) return <p className="dash-saving">Loading…</p>

    return (
        <Section title="Individual Award Categories" description="Create award categories that scorers will nominate students for after submitting a ballot.">
            {error && <div className="tc-error-banner">{error}</div>}

            <div className="tab-actions">
                <AddButton onClick={openAddModal}>+ Add category</AddButton>
            </div>

            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Min Nominees</th>
                            <th>Max Nominees</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.length === 0 && (
                            <tr><td colSpan={4} className="dash-empty-cell">No award categories yet.</td></tr>
                        )}
                        {categories.map(cat => (
                            <tr key={cat.id}>
                                <td className="dash-team-code">{cat.name}</td>
                                <td>{cat.minNominees}</td>
                                <td>{cat.maxNominees}</td>
                                <td>
                                    <div className="dash-actions-cell">
                                        <button className="dash-remove-btn" onClick={() => openEditModal(cat)}>Edit</button>
                                        <DangerButton onClick={() => confirmRemove.open(cat)}>Remove</DangerButton>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <ModalBackdrop onClose={() => setShowModal(false)}>
                    <div className="confirm-modal" role="dialog" aria-modal="true">
                        <h2>{editingId ? 'Edit award category' : 'Add award category'}</h2>
                        {formError && <div className="tc-error-banner">{formError}</div>}
                        <form className="tc-form" onSubmit={e => { e.preventDefault(); handleSave() }} noValidate>
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="ac-name">Category Name</label>
                                <input id="ac-name" type="text" className="tc-input" required
                                    value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Best Attorney" />
                            </div>
                            <div className="tc-field tc-field--row">
                                <div className="tc-field-col">
                                    <label className="tc-label" htmlFor="ac-min">Min Nominees</label>
                                    <input id="ac-min" type="number" className="tc-input" min={0}
                                        value={minNominees} onChange={e => setMinNominees(+e.target.value)} />
                                </div>
                                <div className="tc-field-col">
                                    <label className="tc-label" htmlFor="ac-max">Max Nominees</label>
                                    <input id="ac-max" type="number" className="tc-input" min={1}
                                        value={maxNominees} onChange={e => setMaxNominees(+e.target.value)} />
                                </div>
                            </div>
                            <div className="confirm-actions">
                                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" disabled={!name.trim()}>{editingId ? 'Save' : 'Add category'}</button>
                            </div>
                        </form>
                    </div>
                </ModalBackdrop>
            )}

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message={`Remove "${confirmRemove.pending.name}" award category? Any scoring fields linked to it will become unlinked.`}
                    onCancel={confirmRemove.clear}
                    onConfirm={() => handleDelete(confirmRemove.pending!)}
                />
            )}
        </Section>
    )
}

import { useEffect, useState } from "react";
import type { ICustomRosterColumn } from "@mock-scores/shared";
import { apiFetch } from "../../auth/auth.ts";
import LoadingPage from "../../layout/LoadingPage.tsx";
import Section from "./Section";
import ModalBackdrop from "../../shared/components/ModalBackdrop";
import { ConfirmRemoveModal } from "../components/modals";
import { useConfirmRemove } from "../../shared/hooks/useConfirmRemove";
import DangerButton from "../../shared/components/DangerButton";
import AddButton from "../../shared/components/AddButton";

interface Props {
    tournamentId: string
}

type ColumnType = ICustomRosterColumn['type']

const TYPE_LABELS: Record<ColumnType, string> = {
    string: 'Text',
    int: 'Number',
}

export const CustomRosterFields = ({ tournamentId }: Props) => {
    const [columns, setColumns] = useState<ICustomRosterColumn[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [showModal, setShowModal] = useState(false);
    // The column being edited, identified by its original field name. `null` = adding.
    const [editingField, setEditingField] = useState<string | null>(null);
    const [field, setField] = useState('');
    const [type, setType] = useState<ColumnType>('string');
    const [formError, setFormError] = useState<string | null>(null);
    const confirmRemove = useConfirmRemove<ICustomRosterColumn>();

    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/roster-columns`)
            .then(r => r.ok ? r.json() : [])
            .then((cols: ICustomRosterColumn[]) => setColumns(cols))
            .catch(() => setError('Failed to load custom roster fields.'))
            .finally(() => setLoading(false))
    }, [tournamentId]);

    const openAddModal = () => {
        setEditingField(null);
        setField('');
        setType('string');
        setFormError(null);
        setShowModal(true);
    };

    const openEditModal = (col: ICustomRosterColumn) => {
        setEditingField(col.field);
        setField(col.field);
        setType(col.type);
        setFormError(null);
        setShowModal(true);
    };

    const handleSave = async () => {
        const trimmed = field.trim();
        if (!trimmed) { setFormError('Field name is required'); return }

        try {
            if (editingField !== null) {
                const r = await apiFetch(`/organizer/tournament/${tournamentId}/roster-columns`, {
                    method: 'PUT',
                    body: JSON.stringify({ originalField: editingField, field: trimmed, type }),
                });
                if (!r.ok) {
                    const data = await r.json().catch(() => ({}));
                    throw new Error(data.message ?? 'Failed to save field.');
                }
                const updated: ICustomRosterColumn = await r.json();
                setColumns(prev => prev.map(c => c.field === editingField ? updated : c));
            } else {
                const r = await apiFetch(`/organizer/tournament/${tournamentId}/roster-columns`, {
                    method: 'POST',
                    body: JSON.stringify({ field: trimmed, type }),
                });
                if (!r.ok) {
                    const data = await r.json().catch(() => ({}));
                    throw new Error(data.message ?? 'Failed to add field.');
                }
                const created: ICustomRosterColumn = await r.json();
                setColumns(prev => [...prev, created]);
            }
            setShowModal(false);
        } catch (e) {
            setFormError(e instanceof Error ? e.message : 'Failed to save field.');
        }
    };

    const handleDelete = (col: ICustomRosterColumn) => {
        apiFetch(`/organizer/tournament/${tournamentId}/roster-columns`, {
            method: 'DELETE',
            body: JSON.stringify({ field: col.field }),
        })
            .then(r => { if (!r.ok && r.status !== 204) throw new Error() })
            .catch(console.error);
        setColumns(prev => prev.filter(c => c.field !== col.field));
        confirmRemove.clear();
    };

    if (loading) {
        return <LoadingPage loadingText={"Fetching fields"} />
    }

    return (
        <Section title="Custom Roster Fields" description="Add extra columns coaches will fill in on their team roster (e.g., grade level, t-shirt size, number of competition).">
            {error && <div className="tc-error-banner">{error}</div>}

            <div className="tab-actions">
                <AddButton onClick={openAddModal}>+ Add field</AddButton>
            </div>

            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead>
                        <tr>
                            <th>Field Name</th>
                            <th>Type</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {columns.length === 0 && (
                            <tr><td colSpan={3} className="dash-empty-cell">No custom roster fields yet.</td></tr>
                        )}
                        {columns.map(col => (
                            <tr key={col.field}>
                                <td className="dash-team-code">{col.field}</td>
                                <td>{TYPE_LABELS[col.type]}</td>
                                <td>
                                    <div className="dash-actions-cell">
                                        <button className="dash-remove-btn" onClick={() => openEditModal(col)}>Edit</button>
                                        <DangerButton onClick={() => confirmRemove.open(col)}>Remove</DangerButton>
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
                        <h2>{editingField !== null ? 'Edit custom field' : 'Add custom field'}</h2>
                        {formError && <div className="tc-error-banner">{formError}</div>}
                        <form className="tc-form" onSubmit={e => { e.preventDefault(); handleSave() }} noValidate>
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="crf-name">Field Name</label>
                                <input id="crf-name" type="text" className="tc-input" required
                                    value={field} onChange={e => setField(e.target.value)} placeholder="e.g. Grade Level" />
                            </div>
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="crf-type">Type</label>
                                <select id="crf-type" className="tc-input"
                                    value={type} onChange={e => setType(e.target.value as ColumnType)}>
                                    <option value="string">Text</option>
                                    <option value="int">Number</option>
                                </select>
                            </div>
                            <div className="confirm-actions">
                                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" disabled={!field.trim()}>{editingField !== null ? 'Save' : 'Add field'}</button>
                            </div>
                        </form>
                    </div>
                </ModalBackdrop>
            )}

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message={`Remove the "${confirmRemove.pending.field}" custom roster field? Any values coaches entered for it will be lost.`}
                    onCancel={confirmRemove.clear}
                    onConfirm={() => handleDelete(confirmRemove.pending!)}
                />
            )}
        </Section>
    )
}

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '../../auth/auth'
import type { IWitnessCallOrder } from '@mock-scores/shared'
import '../../organizer/styles/organizer.css'
import '../../organizer/styles/tabs.css'
import '../../organizer/styles/round-view.css'
import '../../organizer/styles/standings.css'

interface Witness { id: string; name: string; side: string }

export default function WitnessCallOrder() {
    const { id: tournamentId, teamId, pairingId } = useParams<{ id: string; teamId: string; pairingId: string }>()
    const navigate = useNavigate()

    const [witnesses, setWitnesses] = useState<Witness[]>([])
    const [slots, setSlots] = useState<string[]>([])   // array of witness IDs, one per slot
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!tournamentId || !teamId || !pairingId) return
        const urlSide = (new URLSearchParams(window.location.search).get('side') ?? 'p') as 'p' | 'd'

        Promise.all([
            apiFetch(`/coach/tournaments/${tournamentId}/witnesses`).then(r => r.ok ? r.json() : []),
            apiFetch(`/coach/tournaments/${tournamentId}/format`).then(r => r.ok ? r.json() : null),
            apiFetch(`/coach/teams/${teamId}/pairings/${pairingId}/witness-order`).then(r => r.ok ? r.json() : []),
        ]).then(([wits, fmt, saved]: [Witness[], { p_witnesses_called: number; d_witnesses_called: number } | null, IWitnessCallOrder[]]) => {
            const relevant = wits.filter(w => w.side === (urlSide === 'p' ? 'P' : 'D') || w.side === 'S')
            setWitnesses(relevant)
            const count = fmt ? (urlSide === 'p' ? fmt.p_witnesses_called : fmt.d_witnesses_called) : 0
            // Pre-fill slots from saved order, pad with empty strings up to count
            const savedIds = saved.map(w => w.witness_id)
            const initial = Array.from({ length: count }, (_, i) => savedIds[i] ?? '')
            setSlots(initial)
        }).catch(() => {})
    }, [tournamentId, teamId, pairingId])

    function setSlot(index: number, witnessId: string) {
        setSlots(prev => {
            const next = [...prev]
            // Clear any other slot that already has this witness selected
            for (let i = 0; i < next.length; i++) {
                if (i !== index && next[i] === witnessId) next[i] = ''
            }
            next[index] = witnessId
            return next
        })
    }

    async function handleSave() {
        if (!teamId || !pairingId) return
        setSaving(true)
        await apiFetch(`/coach/teams/${teamId}/pairings/${pairingId}/witness-order`, {
            method: 'PUT',
            body: JSON.stringify({ witness_ids: slots.filter(Boolean) }),
        })
        setSaving(false)
        navigate(-1)
    }

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => navigate(-1)}>← Back to schedule</button>
                <h1>Witness Call Order</h1>
                {witnesses.length === 0
                    ? <p className="coach-empty">No witnesses configured for this tournament.</p>
                    : slots.length === 0
                    ? <p className="coach-empty">No witness call limit configured for this tournament.</p>
                    : (
                        <table className="dash-standings-table">
                            <thead><tr><th>Call #</th><th>Witness</th></tr></thead>
                            <tbody>{slots.map((val, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td>
                                        <select
                                            className="rv-select"
                                            value={val}
                                            onChange={e => setSlot(i, e.target.value)}
                                        >
                                            <option value="">— select witness —</option>
                                            {witnesses.map(w => (
                                                <option key={w.id} value={w.id} disabled={slots.includes(w.id) && slots[i] !== w.id}>
                                                    {w.name}{w.side === 'S' ? ' (Swing)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}</tbody>
                        </table>
                    )
                }
                <div className="tab-actions" style={{ marginTop: 16 }}>
                    <button className="btn-confirm" onClick={handleSave} disabled={saving}>Save</button>
                    <button className="btn-cancel" onClick={() => navigate(-1)} disabled={saving}>Cancel</button>
                </div>
            </div>
        </main>
    )
}

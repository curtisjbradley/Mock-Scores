import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../auth/auth'
import type { IBallotStatus, ICourtroom, IPairing, IPairingScorer, IRound, IScorer, ITeam } from '@mock-scores/shared'

/**
 * Loads all data needed to display and manage a single tournament round.
 *
 * On mount, fetches the round, teams, courtrooms, pairings, scorers, and each
 * pairing's assigned scorers in one parallel batch. Redirects to `/` when
 * either param is missing, and sets `notFound: true` on a 404 response.
 *
 * @param id - Tournament ID from the route param
 * @param roundId - Round ID from the route param
 */
export function useRoundView(id: string | undefined, roundId: string | undefined) {
    const navigate = useNavigate()
    const [round, setRound] = useState<IRound | null>(null)
    const [teams, setTeams] = useState<ITeam[]>([])
    const [courtrooms, setCourtrooms] = useState<ICourtroom[]>([])
    const [pairings, setPairings] = useState<IPairing[]>([])
    const [scorers, setScorers] = useState<IScorer[]>([])
    const [pairingScorers, setPairingScorers] = useState<Record<string, IPairingScorer[]>>({})
    const [ballotStatus, setBallotStatus] = useState<Record<string, IBallotStatus>>({})
    const [conflictSet, setConflictSet] = useState<Set<string>>(new Set())
    const [error, setError] = useState('')
    const [notFound, setNotFound] = useState(false)

    useEffect(() => {
        if (!id || !roundId) { navigate('/'); return }
        Promise.all([
            apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}`).then(r => {
                if (r.status === 404) { setNotFound(true); throw new Error('not found') }
                if (!r.ok) throw new Error('Round not found')
                return r.json()
            }),
            apiFetch(`/api/organizer/tournament/${id}/teams`).then(r => r.json()),
            apiFetch(`/api/organizer/tournament/${id}/courtrooms`).then(r => r.json()),
            apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}/pairings`).then(r => r.json()),
            apiFetch(`/api/organizer/tournament/${id}/scorers`).then(r => r.json()),
        ]).then(([roundData, teamsData, courtroomsData, pairingsData, scorersData]) => {
            setRound(roundData); setTeams(teamsData); setCourtrooms(courtroomsData)
            setPairings(pairingsData); setScorers(Array.isArray(scorersData) ? scorersData : [])
            return Promise.all([
                Promise.all((pairingsData as IPairing[]).map((p: IPairing) =>
                    apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}/pairings/${p.pairing_id}/scorers`)
                        .then(r => r.json())
                        .then((s: IPairingScorer[]) => [p.pairing_id, s] as [string, IPairingScorer[]])
                )),
                apiFetch(`/api/organizer/tournament/${id}/scorer-conflicts`).then(r => r.ok ? r.json() : []),
                apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}/ballot-status`).then(r => r.ok ? r.json() : []),
            ])
        }).then(([entries, conflicts, ballotStatuses]) => {
            setPairingScorers(Object.fromEntries(entries as [string, IPairingScorer[]][]))
            setConflictSet(new Set((conflicts as { scorer_id: string; team_id: string }[]).map(c => `${c.scorer_id}:${c.team_id}`)))
            const statusMap: Record<string, IBallotStatus> = {}
            for (const s of ballotStatuses as IBallotStatus[]) {
                statusMap[s.pairing_id] = s
            }
            setBallotStatus(statusMap)
        }).catch(() => setError('Failed to load round data.'))
    }, [id, roundId, navigate])

    const saveName = (val: string) => {
        const name = val.trim() || round?.name || ''
        if (!round || name === round.name) return
        const updated = { ...round, name }
        setRound(updated)
        apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}`, {
            method: 'PATCH', body: JSON.stringify(updated),
        }).catch(() => setError('Failed to save name.'))
    }

    const addMatchup = (pros: string, def: string, courtroomId: string, onSuccess: () => void) => {
        apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}/pairings`, {
            method: 'POST',
            body: JSON.stringify({ prosectionID: pros, defenseID: def, courtroomID: courtroomId }),
        }).then(async r => {
            const data = await r.json()
            if (!r.ok) throw new Error(data.message ?? 'Failed to add matchup.')
            return data
        }).then((created: IPairing) => {
            setPairings(prev => [...prev, created])
            onSuccess()
        }).catch((e: Error) => setError(e.message))
    }

    const updatePairing = (updated: IPairing) =>
        setPairings(prev => prev.map(p => p.pairing_id === updated.pairing_id ? updated : p))

    const removePairing = (pairing: IPairing) => {
        apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}/pairings/${pairing.pairing_id}`, { method: 'DELETE' })
            .catch(() => setError('Failed to remove matchup.'))
        setPairings(prev => prev.filter(p => p.pairing_id !== pairing.pairing_id))
    }

    const onScorerAssigned = (pairingId: string, scorer: IPairingScorer) =>
        setPairingScorers(prev => ({ ...prev, [pairingId]: [...(prev[pairingId] ?? []), scorer] }))

    const onScorerRemoved = (pairingId: string, assignmentId: string) =>
        setPairingScorers(prev => ({ ...prev, [pairingId]: (prev[pairingId] ?? []).filter(s => s.assignment_id !== assignmentId) }))

    const onPresiderChanged = (pairingId: string, assignmentId: string | null) =>
        setPairingScorers(prev => ({
            ...prev,
            [pairingId]: (prev[pairingId] ?? []).map(s => ({ ...s, is_presider: s.assignment_id === assignmentId })),
        }))

    return {
        round, teams, courtrooms, pairings, scorers, pairingScorers, ballotStatus, conflictSet,
        error, notFound,
        saveName, addMatchup, updatePairing, removePairing, setPairings,
        onScorerAssigned, onScorerRemoved, onPresiderChanged,
    }
}

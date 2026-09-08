import { lazy, useEffect, useState } from 'react'
import type { StandingsConfig } from '../blockly/standingsGenerator'

const StandingsBuilder = lazy(() => import('../blockly/StandingsBuilder'))
const StandingsPreview = lazy(() => import('../blockly/StandingsPreview'))
import { fetchStandingsConfig, saveStandingsConfig } from '../hooks/useTournamentData'

interface Props {
    tournamentId: string
    onConfigChange?: (config: StandingsConfig) => void
}

export default function TiebreakersTab({ tournamentId, onConfigChange }: Props) {
    const [config, setConfig] = useState<StandingsConfig>({ statDefs: [], columns: [], tiebreakers: [] })
    const [dslSnapshot, setDslSnapshot] = useState<string | null>(null)
    const [initialDsl, setInitialDsl] = useState<string | null | undefined>(undefined)
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState<string | null>(null)

    useEffect(() => {
        fetchStandingsConfig(tournamentId)
            .then(cfg => setInitialDsl(cfg?.dsl ?? null))
            .catch(() => setInitialDsl(null))
    }, [tournamentId])

    const handleChange = (cfg: StandingsConfig, dsl: string) => {
        setConfig(cfg)
        setDslSnapshot(dsl)
        setDirty(true)
        setSaveMsg(null)
        onConfigChange?.(cfg)
    }

    const handleSave = async () => {
        if (dslSnapshot === null) return
        setSaving(true)
        setSaveMsg(null)
        try {
            await saveStandingsConfig(tournamentId, { dsl: dslSnapshot })
            setDirty(false)
            setSaveMsg('Saved!')
        } catch {
            setSaveMsg('Save failed.')
        } finally {
            setSaving(false)
        }
    }

    if (initialDsl === undefined) return null

    return (
        <div className="dash-section">
            <StandingsPreview config={config} />

            <h3 className="tb-title">Standings Configuration</h3>
            <p className="tb-description">
                Define custom stats from tournament data, then configure which columns appear
                in the standings table and how ties are broken.
            </p>
            <StandingsBuilder onChange={handleChange} initialDsl={initialDsl} />

            <div className="tb-save-bar">
                <button className="btn-confirm" onClick={handleSave} disabled={saving || !dirty}>
                    {saving ? 'Saving…' : 'Save changes'}
                </button>
                {saveMsg && <span className={`tb-save-msg ${saveMsg === 'Saved!' ? 'tb-save-msg--ok' : 'tb-save-msg--err'}`}>{saveMsg}</span>}
                {dirty && !saving && <span className="tb-unsaved">Unsaved changes</span>}
            </div>
        </div>
    )
}

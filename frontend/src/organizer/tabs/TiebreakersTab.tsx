import { useEffect, useState } from 'react'
import StandingsBuilder from '../blockly/StandingsBuilder'
import StandingsPreview from '../blockly/StandingsPreview'
import type { StandingsConfig } from '../blockly/standingsGenerator'
import { fetchStandingsConfig, saveStandingsConfig } from '../hooks/useTournamentData'

interface Props {
    tournamentId: string
    onConfigChange?: (config: StandingsConfig) => void
}

export default function TiebreakersTab({ tournamentId, onConfigChange }: Props) {
    const [config, setConfig] = useState<StandingsConfig>({ statDefs: [], columns: [], tiebreakers: [] })
    const [xmlSnapshot, setXmlSnapshot] = useState<{ statsXml: string; standingsXml: string } | null>(null)
    const [initialXml, setInitialXml] = useState<{ statsXml: string; standingsXml: string } | null | undefined>(undefined)
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState<string | null>(null)

    useEffect(() => {
        fetchStandingsConfig(tournamentId)
            .then(cfg => setInitialXml(cfg ?? null))
            .catch(() => setInitialXml(null))
    }, [tournamentId])

    const handleChange = (cfg: StandingsConfig, xml: { statsXml: string; standingsXml: string }) => {
        setConfig(cfg)
        setXmlSnapshot(xml)
        setDirty(true)
        setSaveMsg(null)
        onConfigChange?.(cfg)
    }

    const handleSave = async () => {
        if (!xmlSnapshot) return
        setSaving(true)
        setSaveMsg(null)
        try {
            await saveStandingsConfig(tournamentId, xmlSnapshot)
            setDirty(false)
            setSaveMsg('Saved!')
        } catch {
            setSaveMsg('Save failed.')
        } finally {
            setSaving(false)
        }
    }

    if (initialXml === undefined) return null

    return (
        <div className="dash-section">
            <StandingsPreview config={config} />

            <h3 className="tb-title">Standings Configuration</h3>
            <p className="tb-description">
                Define custom stats from tournament data, then configure which columns appear
                in the standings table and how ties are broken.
            </p>
            <StandingsBuilder onChange={handleChange} initialXml={initialXml} />

            <div className="tb-save-bar">
                <button className="org-new-btn" onClick={handleSave} disabled={saving || !dirty}>
                    {saving ? 'Saving…' : 'Save changes'}
                </button>
                {saveMsg && <span className={`tb-save-msg ${saveMsg === 'Saved!' ? 'tb-save-msg--ok' : 'tb-save-msg--err'}`}>{saveMsg}</span>}
                {dirty && !saving && <span className="tb-unsaved">Unsaved changes</span>}
            </div>
        </div>
    )
}

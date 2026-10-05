import { useMemo } from 'react'
import { parseDsl } from '@mock-scores/standings-dsl'
import type { TiebreakerRule, RankMethod } from '@mock-scores/standings-dsl'
import '../styles/standings.css'

interface Props {
    dsl: string
    onClose?: () => void
}

const METHOD_LABEL: Record<RankMethod, string> = {
    first: 'sequential (no shared ranks)',
    min: 'minimum rank for ties',
    max: 'maximum rank for ties',
    average: 'average rank for ties',
    dense: 'dense (no rank gaps)',
}

function describeRule(t: TiebreakerRule): string {
    switch (t.type) {
        case 'stat':
            return `Break ties by ${t.stat} (${t.order === 'desc' ? 'highest first' : 'lowest first'})`
        case 'h2h_conditional':
            return `Head-to-head on ${t.stat} (${t.order === 'desc' ? 'higher wins' : 'lower wins'})`
        case 'alpha':
            return `Alphabetical by team ${t.field} (${t.order === 'desc' ? 'Z→A' : 'A→Z'})`
        case 'when_tied':
            return `If ${t.min}–${t.max} teams tie: ${t.rules.map(describeRule).join('; then ')}`
    }
}

export default function TiebreakerViewer({ dsl, onClose }: Props) {
    const tiebreakers = useMemo(() => {
        try {
            return parseDsl(dsl).tiebreakers
        } catch {
            return { method: 'first' as RankMethod, rules: [] }
        }
    }, [dsl])

    const content = (
        <>
            <div className="sb-workspace-header">
                <h4 className="sb-workspace-label">Tiebreakers</h4>
                {onClose && <button className="sb-expand-btn" onClick={onClose}>✕ Close</button>}
            </div>
            {tiebreakers.rules.length === 0
                ? <p className="sb-tb-empty">No tiebreakers configured.</p>
                : <ol className="sb-tb-list">
                    {tiebreakers.rules.map((t, i) => (
                        <li key={i}>{describeRule(t)}</li>
                    ))}
                </ol>
            }
            <p className="sb-tb-method">Final ranking: {METHOD_LABEL[tiebreakers.method]}</p>
        </>
    )

    if (onClose) {
        return (
            <div className="sb-fullscreen-overlay">
                <div className="sb-tb-overlay-body">{content}</div>
            </div>
        )
    }

    return <div>{content}</div>
}

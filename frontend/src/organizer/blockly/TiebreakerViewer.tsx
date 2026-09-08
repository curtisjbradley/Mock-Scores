import { useMemo } from 'react'
import { parseDsl } from './standingsDsl'
import '../styles/standings.css'

interface Props {
    dsl: string
    onClose?: () => void
}

export default function TiebreakerViewer({ dsl, onClose }: Props) {
    const tiebreakers = useMemo(() => {
        try {
            return parseDsl(dsl).tiebreakers
        } catch {
            return []
        }
    }, [dsl])

    const content = (
        <>
            <div className="sb-workspace-header">
                <h4 className="sb-workspace-label">Tiebreakers</h4>
                {onClose && <button className="sb-expand-btn" onClick={onClose}>✕ Close</button>}
            </div>
            {tiebreakers.length === 0
                ? <p className="sb-tb-empty">No tiebreakers configured.</p>
                : <ol className="sb-tb-list">
                    {tiebreakers.map((t, i) => (
                        <li key={i}>
                            {t.type === 'h2h_conditional'
                                ? <>If 2-way tie: head-to-head <strong>{t.stat}</strong> ({t.order === 'desc' ? 'higher wins' : 'lower wins'})</>
                                : <>Break ties by <strong>{t.stat}</strong> ({t.order === 'desc' ? 'highest first' : 'lowest first'})</>
                            }
                        </li>
                    ))}
                </ol>
            }
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

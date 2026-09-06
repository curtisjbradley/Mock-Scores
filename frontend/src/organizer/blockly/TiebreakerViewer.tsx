import { useMemo } from 'react'
import * as Blockly from 'blockly'
import '../styles/standings.css'

interface Props {
    standingsXml: string
    onClose?: () => void
}

export default function TiebreakerViewer({ standingsXml, onClose }: Props) {
    const tiebreakers = useMemo(() => {
        try {
            const dom = Blockly.utils.xml.textToDom(standingsXml)
            // Walk the linked chain from tiebreaker_order hat
            const hat = Array.from(dom.querySelectorAll('block[type="tiebreaker_order"]'))[0]
            if (!hat) return []
            const rules: { type: string; stat: string; order: string }[] = []
            let next = hat.querySelector(':scope > next > block')
            while (next) {
                const type = next.getAttribute('type')
                const stat = next.querySelector(':scope > field[name="STAT"]')?.textContent ?? ''
                const order = next.querySelector(':scope > field[name="ORDER"]')?.textContent ?? 'desc'
                if (type === 'standings_tiebreaker' || type === 'standings_h2h_conditional') {
                    rules.push({ type, stat, order })
                }
                next = next.querySelector(':scope > next > block')
            }
            return rules
        } catch {
            return []
        }
    }, [standingsXml])

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
                            {t.type === 'standings_h2h_conditional'
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

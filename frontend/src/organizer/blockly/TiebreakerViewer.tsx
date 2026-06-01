import { useEffect, useRef } from 'react'
import * as Blockly from 'blockly'
import { tiebreakerBlockDefs } from './tiebreakerBlocks'
import { standingsBlockDefs } from './standingsBlocks'

Blockly.common.defineBlocks(tiebreakerBlockDefs)
Blockly.common.defineBlocks(standingsBlockDefs)

interface Props {
    standingsXml: string
    onClose: () => void
}

export default function TiebreakerViewer({ standingsXml, onClose }: Props) {
    const divRef = useRef<HTMLDivElement>(null)
    const wsRef = useRef<Blockly.WorkspaceSvg | null>(null)

    useEffect(() => {
        if (!divRef.current || wsRef.current) return
        const ws = Blockly.inject(divRef.current, { readOnly: true, scrollbars: true })
        wsRef.current = ws
        Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(standingsXml), ws)
        return () => { ws.dispose(); wsRef.current = null }
    }, [standingsXml])

    return (
        <div className="sb-fullscreen-overlay">
            <div className="sb-fullscreen-header">
                <span>Tiebreakers</span>
                <button className="sb-expand-btn" onClick={onClose}>✕ Close</button>
            </div>
            <div ref={divRef} className="sb-fullscreen-ws" />
        </div>
    )
}

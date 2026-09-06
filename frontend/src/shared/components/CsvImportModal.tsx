import { useState, useRef } from 'react'
import ModalBackdrop from './ModalBackdrop'
import Icon from './Icon'

interface CsvImportModalProps {
    title: string
    description: string
    columns: string[]
    exampleRow: string
    onClose: () => void
    onImport: (csv: string) => Promise<{ created: number; errors: { row: number; message: string }[] }>
}

export default function CsvImportModal({ title, description, columns, exampleRow, onClose, onImport }: CsvImportModalProps) {
    const [csvText, setCsvText] = useState('')
    const [preview, setPreview] = useState<string[][] | null>(null)
    const [importing, setImporting] = useState(false)
    const [result, setResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
            const text = reader.result as string
            setCsvText(text)
            parsePreview(text)
        }
        reader.readAsText(file)
    }

    const parsePreview = (text: string) => {
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
        const rows = lines.slice(0, 6).map(line => {
            const fields: string[] = []
            let current = ''
            let inQuotes = false
            for (let i = 0; i < line.length; i++) {
                const ch = line[i]
                if (inQuotes) {
                    if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
                    else if (ch === '"') inQuotes = false
                    else current += ch
                } else {
                    if (ch === '"') inQuotes = true
                    else if (ch === ',') { fields.push(current.trim()); current = '' }
                    else current += ch
                }
            }
            fields.push(current.trim())
            return fields
        })
        setPreview(rows)
    }

    const handleTextChange = (text: string) => {
        setCsvText(text)
        if (text.trim()) parsePreview(text)
        else setPreview(null)
    }

    const handleImport = async () => {
        if (!csvText.trim()) return
        setImporting(true)
        try {
            const res = await onImport(csvText)
            setResult(res)
        } catch {
            setResult({ created: 0, errors: [{ row: 0, message: 'Import failed' }] })
        } finally {
            setImporting(false)
        }
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="confirm-modal csv-import-modal" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
                <h2 id="csv-import-title">{title}</h2>
                <p style={{ margin: '0 0 12px', fontSize: '0.9em', color: '#666' }}>{description}</p>

                {!result ? (
                    <>
                        <div style={{ margin: '0 0 12px', fontSize: '0.85em', color: '#555' }}>
                            <strong>Expected columns:</strong> {columns.join(', ')}
                            <br />
                            <strong>Example:</strong> <code style={{ background: '#f3f4f6', padding: '2px 4px', borderRadius: 3 }}>{exampleRow}</code>
                        </div>

                        <div className="tc-field">
                            <label className="tc-label" htmlFor="csv-file-upload" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Icon name="Upload" size={0.9} />
                                Upload CSV file
                            </label>
                            <input
                                id="csv-file-upload"
                                ref={fileRef}
                                type="file"
                                accept=".csv,text/csv"
                                onChange={handleFileChange}
                                style={{ fontSize: '0.9em' }}
                            />
                        </div>

                        <div className="tc-field">
                            <label className="tc-label" htmlFor="csv-text-paste">Or paste CSV text</label>
                            <textarea
                                id="csv-text-paste"
                                className="tc-input"
                                rows={5}
                                placeholder={`${columns.join(',')}\n${exampleRow}`}
                                value={csvText}
                                onChange={e => handleTextChange(e.target.value)}
                                style={{ fontFamily: 'monospace', fontSize: '0.85em' }}
                            />
                        </div>

                        {preview && preview.length > 0 && (
                            <div style={{ margin: '8px 0 12px', overflowX: 'auto' }}>
                                <strong style={{ fontSize: '0.85em' }}>Preview ({preview.length} row{preview.length > 1 ? 's' : ''} shown):</strong>
                                <table className="dash-standings-table" style={{ fontSize: '0.8em', marginTop: 4 }}>
                                    <tbody>
                                        {preview.map((row, i) => (
                                            <tr key={i}>
                                                {row.map((cell, j) => <td key={j}>{cell || <span style={{ opacity: 0.4 }}>—</span>}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="confirm-actions">
                            <button type="button" onClick={onClose}>Cancel</button>
                            <button type="button" disabled={!csvText.trim() || importing} onClick={handleImport}>
                                {importing ? 'Importing…' : 'Import'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ margin: '12px 0' }}>
                            {result.created > 0 && (
                                <p style={{ color: '#16a34a', fontWeight: 600 }}>
                                    ✓ Successfully imported {result.created} record{result.created !== 1 ? 's' : ''}.
                                </p>
                            )}
                            {result.errors.length > 0 && (
                                <div>
                                    <p style={{ color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>
                                        {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}:
                                    </p>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85em', maxHeight: 150, overflowY: 'auto' }}>
                                        {result.errors.map((err, i) => (
                                            <li key={i} style={{ color: '#dc2626', padding: '2px 0' }}>
                                                {err.row > 0 ? `Row ${err.row}: ` : ''}{err.message}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="confirm-actions">
                            <button type="button" onClick={onClose}>Done</button>
                        </div>
                    </>
                )}
            </div>
        </ModalBackdrop>
    )
}

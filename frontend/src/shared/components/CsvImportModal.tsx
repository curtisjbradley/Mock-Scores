import { useState, useRef } from 'react'
import ModalBackdrop from './ModalBackdrop'
import Icon from './Icon'
import './styles/csv-import-modal.css'

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
    const [fileName, setFileName] = useState<string | null>(null)
    const [fileError, setFileError] = useState<string | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            setFileError('Choose a CSV smaller than 5 MB, or paste a smaller batch.')
            setFileName(null)
            e.target.value = ''
            return
        }
        setFileError(null)
        setFileName(file.name)
        const reader = new FileReader()
        reader.onload = () => {
            const text = reader.result as string
            setCsvText(text)
            parsePreview(text)
        }
        reader.readAsText(file)
    }

    const parsePreview = (text: string) => {
        const rows: string[][] = []
        let row: string[] = []
        let field = ''
        let inQuotes = false
        for (let i = 0; i < text.length; i++) {
            const ch = text[i]
            if (inQuotes) {
                if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
                else if (ch === '"') inQuotes = false
                else field += ch
            } else if (ch === '"') inQuotes = true
            else if (ch === ',') { row.push(field.trim()); field = '' }
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++
                row.push(field.trim())
                if (row.some(cell => cell)) rows.push(row)
                row = []; field = ''
                if (rows.length === 6) break
            } else field += ch
        }
        if (rows.length < 6 && (field || row.length)) {
            row.push(field.trim())
            if (row.some(cell => cell)) rows.push(row)
        }
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
                <p className="csv-import-description">{description}</p>

                {!result ? (
                    <>
                        <div className="csv-import-columns">
                            <strong>Expected columns:</strong> {columns.join(', ')}
                            <br />
                            <strong>Example:</strong> <code className="csv-import-example">{exampleRow}</code>
                        </div>

                        <div className="tc-field">
                            <span className="tc-label">Upload CSV file</span>
                            <div className="csv-import-upload-row">
                                <input
                                    id="csv-file-upload"
                                    ref={fileRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    onChange={handleFileChange}
                                    className="csv-import-file"
                                />
                                <label className="csv-import-upload-btn" htmlFor="csv-file-upload">
                                    <Icon name="Upload" size={0.9} />
                                    Choose file
                                </label>
                                <span className="csv-import-filename">
                                    {fileName ?? 'No file chosen'}
                                </span>
                            </div>
                            {fileError && <p className="csv-import-error-heading" role="alert">{fileError}</p>}
                        </div>

                        <div className="tc-field">
                            <label className="tc-label" htmlFor="csv-text-paste">Or paste CSV text</label>
                            <textarea
                                id="csv-text-paste"
                                className="tc-input csv-import-textarea"
                                rows={5}
                                placeholder={`${columns.join(',')}\n${exampleRow}`}
                                value={csvText}
                                onChange={e => handleTextChange(e.target.value)}
                            />
                        </div>

                        {preview && preview.length > 0 && (
                            <div className="csv-import-preview">
                                <strong className="csv-import-preview-label">Preview ({preview.length} row{preview.length > 1 ? 's' : ''} shown):</strong>
                                <table className="dash-standings-table csv-import-preview-table">
                                    <tbody>
                                        {preview.map((row, i) => (
                                            <tr key={i}>
                                                {row.map((cell, j) => <td key={j}>{cell || <span className="csv-import-empty">—</span>}</td>)}
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
                        <div className="csv-import-result">
                            {result.created > 0 && (
                                <p className="csv-import-success">
                                    ✓ Successfully imported {result.created} record{result.created !== 1 ? 's' : ''}.
                                </p>
                            )}
                            {result.errors.length > 0 && (
                                <div>
                                    <p className="csv-import-error-heading">
                                        {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}:
                                    </p>
                                    <ul className="csv-import-error-list">
                                        {result.errors.map((err, i) => (
                                            <li key={i} className="csv-import-error-item">
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

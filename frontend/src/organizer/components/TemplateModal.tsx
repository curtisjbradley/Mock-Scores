import { templates } from '../data/templates'

interface Props {
    selected: string
    onSelect: (id: string) => void
    onConfirm: () => void
}

export default function TemplateModal({ selected, onSelect, onConfirm }: Props) {
    return (
        <div className="sf-modal-overlay">
            <div className="sf-modal">
                <h2 className="sf-modal-title">Choose a scoring template</h2>
                <div className="sf-modal-options">
                    {templates.map(t => (
                        <button key={t.id} type="button"
                            className={`sf-modal-option${selected === t.id ? ' sf-modal-option--selected' : ''}`}
                            onClick={() => onSelect(t.id)}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <button type="button" className="org-new-btn" onClick={onConfirm}>Continue →</button>
            </div>
        </div>
    )
}

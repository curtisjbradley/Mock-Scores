const STEPS = [['Details', 1], ['Case format', 2], ['Scoring fields', 3]] as const

interface Props { current: number; onGoTo: (step: number) => void }

export default function TournamentStepper({ current, onGoTo }: Props) {
    return (
        <div className="tc-stepper">
            {STEPS.map(([label, n], i) => {
                const done = current > n
                const active = current === n
                return (
                    <>
                        {i > 0 && <div key={`line-${n}`} className={`tc-step-line${done || active ? ' tc-step-line--done' : ''}`} />}
                        <div key={n}
                            className={`tc-step${active ? ' tc-step--active' : done ? ' tc-step--done' : ''}`}
                            style={done ? { cursor: 'pointer' } : undefined}
                            onClick={() => done && onGoTo(n)}
                        >
                            <span>{done ? '✓' : n}</span>{label}
                        </div>
                    </>
                )
            })}
        </div>
    )
}

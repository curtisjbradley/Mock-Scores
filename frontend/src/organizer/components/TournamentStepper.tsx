import React from 'react'

const STEPS = [['Details', 1], ['Case format', 2], ['Scoring fields', 3], ['Standings', 4]] as const

interface Props { current: number; onGoTo: (step: number) => void }

export default function TournamentStepper({ current, onGoTo }: Props) {
    return (
        <div className="tc-stepper">
            {STEPS.map(([label, n], i) => {
                const done = current > n
                const active = current === n
                return (
                    <React.Fragment key={n}>
                        {i > 0 && <div className={`tc-step-line${done || active ? ' tc-step-line--done' : ''}`} />}
                        <div
                            className={`tc-step${active ? ' tc-step--active' : done ? ' tc-step--done tc-step--clickable' : ''}`}
                            onClick={() => done && onGoTo(n)}
                        >
                            <span>{done ? '✓' : n}</span>{label}
                        </div>
                    </React.Fragment>
                )
            })}
        </div>
    )
}

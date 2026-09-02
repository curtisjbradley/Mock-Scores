import React from 'react'

export interface StepperStep {
    key: string
    label: string
}

interface Props {
    steps: StepperStep[]
    /** Index (0-based) of the current step within `steps`. */
    currentIndex: number
    /** Navigate to a completed step by index. */
    onGoTo: (index: number) => void
}

/**
 * Config-driven progress stepper for the tournament creation wizard. The step
 * list is dynamic because the flow branches (a manual scoring template adds the
 * award and scoring-category steps).
 */
export default function TournamentStepper({ steps, currentIndex, onGoTo }: Props) {
    return (
        <div className="tc-stepper">
            {steps.map((step, i) => {
                const done = currentIndex > i
                const active = currentIndex === i
                return (
                    <React.Fragment key={step.key}>
                        {i > 0 && <div className={`tc-step-line${done || active ? ' tc-step-line--done' : ''}`} />}
                        {done ? (
                            <button
                                type="button"
                                className="tc-step tc-step--done tc-step--clickable"
                                onClick={() => onGoTo(i)}
                            >
                                <span>✓</span>{step.label}
                            </button>
                        ) : (
                            <div className={`tc-step${active ? ' tc-step--active' : ''}`}>
                                <span>{i + 1}</span>{step.label}
                            </div>
                        )}
                    </React.Fragment>
                )
            })}
        </div>
    )
}

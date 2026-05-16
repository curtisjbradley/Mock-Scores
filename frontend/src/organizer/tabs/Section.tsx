import type { ReactNode } from 'react'

interface Props {
    title: string
    description?: string
    children: ReactNode
}

export default function Section({ title, description, children }: Props) {
    return (
        <div className="dash-section">
            <div className="dash-invites-header">
                <h2>{title}</h2>
                <h3>{description}</h3>
            </div>
            {children}
        </div>
    )
}

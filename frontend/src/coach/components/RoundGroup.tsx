import type { ReactNode } from 'react'
import './styles/round-group.css'

interface RoundGroupProps {
    /** Round heading — a plain string or richer node (e.g. name + time). */
    heading: ReactNode
    /** The round's content, typically a results/schedule table. */
    children: ReactNode
}

/**
 * Round-titled wrapper used by the coach Results and Schedule pages. Renders a
 * `<h3>` heading above the round's table so both pages share the same
 * round-grouping markup and styling.
 *
 * @example
 * <RoundGroup heading={round.name}>
 *   <table className="dash-standings-table">…</table>
 * </RoundGroup>
 */
export default function RoundGroup({ heading, children }: RoundGroupProps) {
    return (
        <div className="coach-round-group">
            <h3 className="coach-round-heading">{heading}</h3>
            {children}
        </div>
    )
}

/** Format a date as "Month Day, Year" (e.g. "June 25, 2026"). */
export const formatDate = (d: string | Date): string =>
    new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

/** Format a date range. If start === end, returns a single date. */
export const formatDateRange = (start: string | Date, end?: string | Date): string =>
    !end || String(end) === String(start)
        ? formatDate(start)
        : `${formatDate(start)} – ${formatDate(end)}`

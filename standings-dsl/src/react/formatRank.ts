/**
 * Format the rank number assigned by `computeStandings`/`interp` for display.
 *
 * `computeStandings` sorts rows and assigns each a `rank` honoring the config's
 * final ordering method (pandas-style: first | min | max | average | dense).
 * Display surfaces render this `rank` rather than the array index, so tied teams
 * are numbered per the chosen method instead of always 1, 2, 3, …
 *
 * The `average` method can produce fractional ranks (e.g. two teams tied for
 * 1st–2nd both show 1.5), so non-integers render with one decimal place.
 *
 * @param rank  The computed `rank` from a standings row (optional on the type,
 *              but always present after sorting).
 * @param index The row's array index — used only as a defensive fallback when
 *              `rank` is somehow absent.
 */
export function formatRank(rank: number | undefined, index: number): string {
  const value = rank ?? index + 1;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

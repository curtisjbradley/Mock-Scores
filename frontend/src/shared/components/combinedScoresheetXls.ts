import ExcelJS from 'exceljs'
import type { CombinedBallot, CombinedStat, SegmentRow } from './CombinedScoresheet'

/** Inputs for building the Excel export — mirrors what {@link CombinedScoresheet} renders. */
export interface CombinedExport {
    rows: SegmentRow[]
    ballots: CombinedBallot[]
    prosLabel: string
    prosecutionCode: string
    defenseCode: string
    roundLabel?: string | null
    dateLabel?: string | null
    tiebreaker?: string | null
    /** Tournament-configured standings stats for this trial, per side. */
    statSummary?: CombinedStat[] | null
}

const GRAY = 'FFBFBFBF'
const LIGHT = 'FFFAFAFA'
const RED = 'FFC00000'

function fill(color: string): ExcelJS.Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
}

/**
 * Builds a real `.xlsx` workbook for the combined scoresheet using ExcelJS, so
 * scores are true numeric cells and Excel/Sheets/LibreOffice open it without
 * repair prompts. The layout mirrors the on-screen grid: matchup header,
 * per-scorer Prosecution/Defense columns, one row per segment, a totals row,
 * and a summary block (percentages, presider tiebreaker, winner).
 */
export async function buildCombinedWorkbook(data: CombinedExport): Promise<ExcelJS.Buffer> {
    const { rows, ballots, prosLabel, prosecutionCode, defenseCode, roundLabel, dateLabel, tiebreaker, statSummary } = data
    const prosShort = prosLabel === 'Prosecution' ? 'Pros' : 'Pl'

    // Per-scorer column totals (same math as the component's totals row):
    // each row's scores are weighted by its field multiplier.
    const scorerTotals = ballots.map(b => {
        let p = 0, d = 0
        for (const r of rows) {
            const mult = Number(r.multiplier ?? 1) || 1
            if (r.hasP) p += (b.scores.get(`${r.key}:P`) ?? 0) * mult
            if (r.hasD) d += (b.scores.get(`${r.key}:D`) ?? 0) * mult
        }
        return { p, d }
    })
    const tiebreakerText = tiebreaker
        ? tiebreaker === prosecutionCode ? `${prosLabel} (${prosecutionCode})`
        : tiebreaker === defenseCode ? `Defense (${defenseCode})`
        : tiebreaker
        : null

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Mock Scores'
    const ws = wb.addWorksheet('Scoresheet')

    // Column count: segment + multiplier + 2 per scorer + student.
    const lastCol = 2 + ballots.length * 2 + 1
    ws.getColumn(1).width = 16
    ws.getColumn(2).width = 6
    for (let c = 3; c < lastCol; c++) ws.getColumn(c).width = 7
    ws.getColumn(lastCol).width = 14

    /** Column letter helper for merge ranges (1-based). */
    const col = (n: number) => ws.getColumn(n).letter

    // ── Header: matchup, round, date ──────────────────────────────────────
    const titleRow = ws.addRow([`${prosecutionCode} v. ${defenseCode}`])
    titleRow.getCell(1).font = { bold: true, size: 14 }
    if (roundLabel) ws.addRow([roundLabel]).getCell(1).font = { bold: true }
    if (dateLabel) ws.addRow([dateLabel]).getCell(1).font = { italic: true }
    ws.addRow([]) // spacer

    // ── Header rows: scorer names (merged over 2) + Pros/Def sub-headers ──
    const nameRowValues: (string | null)[] = [`${ballots.length} scorer${ballots.length !== 1 ? 's' : ''}`, 'Mult']
    for (const b of ballots) { nameRowValues.push(b.label, null) }
    nameRowValues.push('')
    const nameRow = ws.addRow(nameRowValues)
    const nameRowIdx = nameRow.number

    const subRowValues: string[] = ['', '']
    for (let i = 0; i < ballots.length; i++) subRowValues.push(prosShort, 'Def')
    subRowValues.push('Student')
    const subRow = ws.addRow(subRowValues)

    // First scorer's P column (defense is the column immediately after each P).
    const firstScorerCol = 3
    const isDefenseCol = (colNum: number) =>
        colNum >= firstScorerCol && colNum < lastCol && (colNum - firstScorerCol) % 2 === 1

    // Merge each scorer name across its two columns; style header band.
    ballots.forEach((_, i) => {
        const start = firstScorerCol + i * 2
        ws.mergeCells(`${col(start)}${nameRowIdx}:${col(start + 1)}${nameRowIdx}`)
    })
    for (const r of [nameRow, subRow]) {
        r.eachCell({ includeEmpty: true }, (cell, colNum) => {
            if (colNum > lastCol) return
            cell.fill = fill(GRAY)
            cell.font = { bold: true, color: isDefenseCol(colNum) ? { argb: RED } : undefined }
            cell.alignment = { horizontal: 'center' }
            cell.border = {
                bottom: { style: 'thin' }, right: { style: 'thin' },
                top: { style: 'thin' }, left: { style: 'thin' },
            }
        })
    }

    // ── Segment rows ──────────────────────────────────────────────────────
    for (const r of rows) {
        const mult = Number(r.multiplier ?? 1) || 1
        const multLabel = `×${Number.isInteger(mult) ? String(mult) : String(Number(mult.toFixed(2)))}`
        const values: (number | string | null)[] = [r.label, multLabel]
        for (const b of ballots) {
            values.push(r.hasP ? (b.scores.get(`${r.key}:P`) ?? null) : null)
            values.push(r.hasD ? (b.scores.get(`${r.key}:D`) ?? null) : null)
        }
        values.push(r.student ?? '')
        const row = ws.addRow(values)
        row.getCell(1).font = { bold: true }
        row.getCell(2).alignment = { horizontal: 'center' }
        // Center scores; color defense columns red.
        for (let i = 0; i < ballots.length; i++) {
            row.getCell(firstScorerCol + i * 2).alignment = { horizontal: 'center' }
            const dCell = row.getCell(firstScorerCol + 1 + i * 2)
            dCell.alignment = { horizontal: 'center' }
            dCell.font = { color: { argb: RED } }
        }
    }

    // ── Totals row ────────────────────────────────────────────────────────
    const totalValues: (number | string)[] = ['Total', '']
    for (const t of scorerTotals) totalValues.push(t.p, t.d)
    totalValues.push('')
    const totalRow = ws.addRow(totalValues)
    totalRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        if (colNum > lastCol) return
        cell.font = { bold: true, color: isDefenseCol(colNum) ? { argb: RED } : undefined }
        cell.fill = fill(LIGHT)
        cell.border = { top: { style: 'medium' } }
        if (colNum > 1) cell.alignment = { horizontal: 'center' }
    })

    // ── Summary block ─────────────────────────────────────────────────────
    // Mirrors the on-screen sheet: only the presider tiebreaker is shown here.
    // Raw point percentages and a points-based "winner" are intentionally
    // omitted — how the trial is won is conveyed by the tournament stats block.
    if (tiebreakerText) {
        ws.addRow([])
        const tbRow = ws.addRow(['Presider tiebreaker', tiebreakerText])
        tbRow.getCell(1).font = { bold: true }
        tbRow.getCell(2).font = { bold: true }
    }

    // ── Tournament stats (per-trial) block ────────────────────────────────
    // Mirrors the on-screen block: how the tournament actually tabulates this
    // trial (ballots won, point differential, custom stats), not just points.
    if (statSummary && statSummary.length > 0) {
        ws.addRow([]) // spacer
        const titleRow = ws.addRow(['Tournament stats - this trial'])
        titleRow.getCell(1).font = { bold: true }

        const headerRow = ws.addRow(['Stat', `${prosShort} (${prosecutionCode})`, `Def (${defenseCode})`])
        headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
            if (colNum > 3) return
            cell.fill = fill(GRAY)
            cell.font = { bold: true, color: colNum === 3 ? { argb: RED } : undefined }
            cell.alignment = { horizontal: colNum === 1 ? 'left' : 'center' }
            cell.border = {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' },
            }
        })

        for (const s of statSummary) {
            const pVal = Number.isNaN(s.prosecution) ? '—' : s.prosecution
            const dVal = Number.isNaN(s.defense) ? '—' : s.defense
            const pLead = s.prosecution > s.defense
            const dLead = s.defense > s.prosecution
            const statRow = ws.addRow([s.label, pVal, dVal])
            statRow.getCell(1).font = { bold: true }
            statRow.getCell(1).alignment = { horizontal: 'left' }
            const pCell = statRow.getCell(2)
            pCell.alignment = { horizontal: 'center' }
            pCell.font = { bold: pLead }
            const dCell = statRow.getCell(3)
            dCell.alignment = { horizontal: 'center' }
            dCell.font = { bold: dLead, color: { argb: RED } }
            for (const cell of [statRow.getCell(1), pCell, dCell]) {
                cell.border = {
                    top: { style: 'thin' }, bottom: { style: 'thin' },
                    left: { style: 'thin' }, right: { style: 'thin' },
                }
            }
        }
    }

    return wb.xlsx.writeBuffer()
}

/** Triggers a browser download of the combined scoresheet as an `.xlsx` file. */
export async function downloadCombinedXlsx(data: CombinedExport, filename: string): Promise<void> {
    const buffer = await buildCombinedWorkbook(data)
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
}

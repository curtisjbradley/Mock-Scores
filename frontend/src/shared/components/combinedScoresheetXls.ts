import ExcelJS from 'exceljs'
import type { CombinedBallot, SegmentRow } from './CombinedScoresheet'

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
    const { rows, ballots, prosLabel, prosecutionCode, defenseCode, roundLabel, dateLabel, tiebreaker } = data
    const prosShort = prosLabel === 'Prosecution' ? 'Pros' : 'Pl'

    // Per-scorer column totals + grand totals (same math as the component).
    const scorerTotals = ballots.map(b => {
        let p = 0, d = 0
        for (const r of rows) {
            if (r.hasP) p += b.scores.get(`${r.key}:P`) ?? 0
            if (r.hasD) d += b.scores.get(`${r.key}:D`) ?? 0
        }
        return { p, d }
    })
    const totalP = scorerTotals.reduce((a, t) => a + t.p, 0)
    const totalD = scorerTotals.reduce((a, t) => a + t.d, 0)
    const combined = totalP + totalD
    const prosPct = combined ? totalP / combined : 0
    const defPct = combined ? totalD / combined : 0
    const winner =
        totalP > totalD ? `${prosLabel} (${prosecutionCode})`
        : totalD > totalP ? `Defense (${defenseCode})`
        : 'Tie'
    const tiebreakerText = tiebreaker
        ? tiebreaker === prosecutionCode ? `${prosLabel} (${prosecutionCode})`
        : tiebreaker === defenseCode ? `Defense (${defenseCode})`
        : tiebreaker
        : null

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Mock Scores'
    const ws = wb.addWorksheet('Scoresheet')

    // Column count: segment + 2 per scorer + student.
    const lastCol = 1 + ballots.length * 2 + 1
    ws.getColumn(1).width = 16
    for (let c = 2; c < lastCol; c++) ws.getColumn(c).width = 7
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
    const nameRowValues: (string | null)[] = [`${ballots.length} scorer${ballots.length !== 1 ? 's' : ''}`]
    for (const b of ballots) { nameRowValues.push(b.label, null) }
    nameRowValues.push('')
    const nameRow = ws.addRow(nameRowValues)
    const nameRowIdx = nameRow.number

    const subRowValues: string[] = ['']
    for (let i = 0; i < ballots.length; i++) subRowValues.push(prosShort, 'Def')
    subRowValues.push('Student')
    const subRow = ws.addRow(subRowValues)

    // Merge each scorer name across its two columns; style header band.
    ballots.forEach((_, i) => {
        const start = 2 + i * 2
        ws.mergeCells(`${col(start)}${nameRowIdx}:${col(start + 1)}${nameRowIdx}`)
    })
    for (const r of [nameRow, subRow]) {
        r.eachCell({ includeEmpty: true }, (cell, colNum) => {
            if (colNum > lastCol) return
            cell.fill = fill(GRAY)
            cell.font = { bold: true, color: colNum % 2 === 1 && colNum > 1 ? { argb: RED } : undefined }
            cell.alignment = { horizontal: 'center' }
            cell.border = {
                bottom: { style: 'thin' }, right: { style: 'thin' },
                top: { style: 'thin' }, left: { style: 'thin' },
            }
        })
    }

    // ── Segment rows ──────────────────────────────────────────────────────
    for (const r of rows) {
        const values: (number | string | null)[] = [r.label]
        for (const b of ballots) {
            values.push(r.hasP ? (b.scores.get(`${r.key}:P`) ?? null) : null)
            values.push(r.hasD ? (b.scores.get(`${r.key}:D`) ?? null) : null)
        }
        values.push(r.student ?? '')
        const row = ws.addRow(values)
        row.getCell(1).font = { bold: true }
        // Center scores; color defense (even data columns) red.
        for (let i = 0; i < ballots.length; i++) {
            row.getCell(2 + i * 2).alignment = { horizontal: 'center' }
            const dCell = row.getCell(3 + i * 2)
            dCell.alignment = { horizontal: 'center' }
            dCell.font = { color: { argb: RED } }
        }
    }

    // ── Totals row ────────────────────────────────────────────────────────
    const totalValues: (number | string)[] = ['Total']
    for (const t of scorerTotals) totalValues.push(t.p, t.d)
    totalValues.push('')
    const totalRow = ws.addRow(totalValues)
    totalRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        if (colNum > lastCol) return
        cell.font = { bold: true, color: colNum % 2 === 1 && colNum > 1 && colNum < lastCol ? { argb: RED } : undefined }
        cell.fill = fill(LIGHT)
        cell.border = { top: { style: 'medium' } }
        if (colNum > 1) cell.alignment = { horizontal: 'center' }
    })

    // ── Summary block ─────────────────────────────────────────────────────
    ws.addRow([])
    const pRow = ws.addRow([`${prosLabel} (${prosecutionCode})`, totalP, prosPct])
    pRow.getCell(1).font = { bold: true }
    pRow.getCell(3).numFmt = '0.00%'
    const dRow = ws.addRow([`Defense (${defenseCode})`, totalD, defPct])
    dRow.getCell(1).font = { bold: true }
    dRow.getCell(3).numFmt = '0.00%'
    if (tiebreakerText) {
        const tbRow = ws.addRow(['Presider tiebreaker', tiebreakerText])
        tbRow.getCell(1).font = { bold: true }
    }
    const winRow = ws.addRow(['Winner', winner])
    winRow.getCell(1).font = { bold: true }
    winRow.getCell(2).font = { bold: true }

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

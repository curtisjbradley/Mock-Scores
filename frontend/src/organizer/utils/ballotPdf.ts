import type { IScoreSheetFormat } from '@mock-scores/shared'

/**
 * Extra metadata rendered in the ballot header that isn't part of the
 * scoresheet format itself.
 */
export interface BallotMeta {
    /** Team code for the prosecution/plaintiff (overrides format if provided). */
    prosecutionCode?: string
    /** Team code for the defense (overrides format if provided). */
    defenseCode?: string
    /** Courtroom display name (overrides format's courtroomNumber if provided). */
    courtroom?: string
    /** Round name, e.g. "Round 1". */
    roundName?: string
    /** ISO date-time string for the round, rendered as a localized date + time. */
    roundTime?: string | null
}

/** Escapes a string for safe interpolation into HTML text/attributes. */
function esc(value: string | null | undefined): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/** A blank underscored line for handwritten entry, e.g. score or name blanks. */
function blankBox(): string {
    return '<span class="score-blank"></span>'
}

/** Builds a single scoring-category table section. */
function renderCategory(fmt: IScoreSheetFormat, catId: string, prosLabel: string): string {
    const cat = fmt.scoringCategories[catId]
    if (!cat) return ''
    const witness = cat.witnessId ? fmt.witnesses[cat.witnessId] : null
    const heading = witness ? `${cat.categoryName} — ${witness.characterName}` : cat.categoryName

    const rows = cat.categoryAssignments.map((a) => {
        const pStudent = a.pStudentId ? fmt.students[a.pStudentId]?.name : null
        const dStudent = a.dStudentId ? fmt.students[a.dStudentId]?.name : null
        const range = `${a.minScore}–${a.maxScore}`
        return `
            <tr>
                <td class="assignment">${esc(a.assignmentName)} <span class="range">(${range})</span></td>
                <td class="score-cell">${a.side !== 'D' ? blankBox() : ''}${pStudent ? `<span class="student">${esc(pStudent)}</span>` : ''}</td>
                <td class="score-cell">${a.side !== 'P' ? blankBox() : ''}${dStudent ? `<span class="student">${esc(dStudent)}</span>` : ''}</td>
            </tr>`
    }).join('')

    return `
        <table class="cat-table">
            <thead>
                <tr class="cat-heading"><th colspan="3">${esc(heading)}</th></tr>
                <tr class="col-heading">
                    <th class="assignment-col">Category</th>
                    <th>${esc(prosLabel)}</th>
                    <th>Defense</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`
}

/** Builds the fill-in-the-blank award nominations section. */
function renderAwards(fmt: IScoreSheetFormat): string {
    const awards = Object.values(fmt.awardCategories)
    if (awards.length === 0) return ''

    const blocks = awards.map((ac) => {
        const count = Math.max(1, ac.maxNominees || 1)
        const lines = Array.from({ length: count }, () => '<span class="award-line"></span>').join('')
        const hint = ac.minNominees === ac.maxNominees
            ? `${ac.maxNominees}`
            : `${ac.minNominees}–${ac.maxNominees}`
        return `
            <div class="award">
                <span class="award-name">${esc(ac.name)} <span class="award-hint">(nominate ${hint})</span></span>
                <span class="award-blanks">${lines}</span>
            </div>`
    }).join('')

    return `
        <div class="awards">
            <div class="section-title">Award Nominations</div>
            ${blocks}
        </div>`
}

/** Builds the presider tiebreaker selector section. */
function renderTiebreaker(fmt: IScoreSheetFormat, meta: BallotMeta): string {
    const prosLabel = fmt.isCriminal ? 'Prosecution' : 'Plaintiff'
    const pCode = esc(meta.prosecutionCode ?? fmt.prosecutionCode)
    const dCode = esc(meta.defenseCode ?? fmt.defenseCode)
    return `
        <div class="tiebreaker">
            <div class="section-title">Presider Tiebreaker</div>
            <div class="tb-note">To be completed by the presiding judge in the event of a tie.</div>
            <div class="tb-options">
                <span class="tb-option"><span class="tb-box"></span> ${prosLabel} (${pCode})</span>
                <span class="tb-option"><span class="tb-box"></span> Defense (${dCode})</span>
            </div>
        </div>`
}

/** Formats the round date/time for the header, or empty string when unavailable. */
function formatRoundTime(roundTime?: string | null): string {
    if (!roundTime) return ''
    const d = new Date(roundTime)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    })
}

/**
 * Print/page-oriented CSS for the ballot. Screen-only chrome (the print bar,
 * page background) lives in the consuming React route, not here, so the same
 * styles drive both the on-screen route and the printed page.
 */
export const BALLOT_STYLES = `
    @page { size: letter portrait; margin: 0.4in; }
    .ballot, .ballot * { box-sizing: border-box; }
    .ballot {
        width: 100%;
        font-family: "Helvetica Neue", Arial, sans-serif;
        color: #111;
        font-size: 8.5px;
        line-height: 1.25;
    }

    .ballot .header { border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 6px; }
    .ballot .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .ballot .tournament-name { font-size: 13px; font-weight: 700; margin: 0; }
    .ballot .case-name { font-size: 9px; font-style: italic; color: #555; margin-top: 1px; }
    .ballot .header-meta { text-align: right; font-size: 8px; }
    .ballot .teams { display: flex; gap: 24px; margin-top: 4px; align-items: baseline; }
    .ballot .team-line { font-size: 13px; }
    .ballot .team-role { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; font-weight: 600; }
    .ballot .team-code { font-size: 13px; font-weight: 700; }

    .ballot .scorer-line { display: flex; gap: 16px; margin: 5px 0; font-size: 8px; }
    .ballot .field { flex: 1; }
    .ballot .field .label { color: #555; text-transform: uppercase; font-size: 7px; letter-spacing: 0.04em; }
    .ballot .field .value { border-bottom: 1px solid #999; display: inline-block; min-width: 90px; padding: 0 3px; }

    .ballot .categories { column-count: 2; column-gap: 10px; }
    .ballot .cat-table {
        width: 100%; border-collapse: collapse; margin-bottom: 5px;
        break-inside: avoid; page-break-inside: avoid;
    }
    .ballot .cat-heading th {
        color: #111; text-align: left; padding: 3px 0 2px;
        font-size: 8.5px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.03em;
        border-top: 2px solid #111; border-bottom: 2px solid #111;
    }
    .ballot .col-heading th {
        border-bottom: 1px solid #111; padding: 1px 4px; font-size: 7px;
        text-transform: uppercase; color: #333; text-align: center;
    }
    .ballot .col-heading .assignment-col { text-align: left; }
    .ballot .cat-table td { padding: 2px 4px; border-bottom: 1px solid #ddd; vertical-align: top; }
    .ballot .cat-table td.assignment { width: 46%; }
    .ballot .cat-table .range { color: #888; font-size: 7px; }
    .ballot .score-cell { text-align: center; width: 27%; }
    .ballot .score-blank {
        display: inline-block; width: 26px; height: 13px;
        border: 1px solid #333; border-radius: 2px; vertical-align: middle;
    }
    .ballot .student { display: block; font-size: 6.5px; color: #444; margin-top: 1px; }

    .ballot .footer { margin-top: 6px; display: flex; gap: 12px; break-inside: avoid; }
    .ballot .signature-line {
        margin-top: 10px; display: flex; gap: 24px; break-inside: avoid;
        font-size: 8px; align-items: flex-end;
    }
    .ballot .signature-line .field { flex: 1; }
    .ballot .signature-line .field--date { flex: 0 0 130px; }
    .ballot .signature-line .value { display: block; border-bottom: 1px solid #333; min-width: 100%; height: 16px; }
    .ballot .awards { flex: 1.4; }
    .ballot .tiebreaker { flex: 1; border: 1px solid #111; padding: 4px 6px; }
    .ballot .section-title {
        font-size: 8.5px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.04em; border-bottom: 1px solid #111;
        margin-bottom: 3px; padding-bottom: 1px;
    }
    .ballot .award { margin-bottom: 4px; }
    .ballot .award-name { font-size: 8px; font-weight: 600; }
    .ballot .award-hint { font-weight: 400; color: #777; font-size: 7px; }
    .ballot .award-blanks { display: block; margin-top: 2px; }
    .ballot .award-line {
        display: inline-block; border-bottom: 1px solid #333;
        height: 12px; min-width: 46%; margin: 0 2% 3px 0;
    }
    .ballot .tb-note { font-size: 7px; color: #555; margin-bottom: 4px; }
    .ballot .tb-option { display: block; font-size: 8.5px; margin-bottom: 4px; }
    .ballot .tb-box {
        display: inline-block; width: 11px; height: 11px;
        border: 1.5px solid #111; vertical-align: middle; margin-right: 4px;
    }`

/**
 * Builds the inner `.ballot` markup (header, categories, awards, tiebreaker,
 * signature) as an HTML string. Rendered by the ballot route via
 * `dangerouslySetInnerHTML` and paired with {@link BALLOT_STYLES}.
 */
export function buildBallotInner(fmt: IScoreSheetFormat, meta: BallotMeta = {}): string {
    const prosLabel = fmt.isCriminal ? 'Prosecution' : 'Plaintiff'
    const pCode = esc(meta.prosecutionCode ?? fmt.prosecutionCode)
    const dCode = esc(meta.defenseCode ?? fmt.defenseCode)
    const courtroom = esc(meta.courtroom ?? fmt.courtroomNumber)
    const roundName = esc(meta.roundName ?? '')
    const roundTime = esc(formatRoundTime(meta.roundTime))
    const caseName = esc(fmt.caseName)
    const tournamentName = esc(fmt.tournamentName)

    const categories = fmt.categoryOrder.map((id) => renderCategory(fmt, id, prosLabel)).join('')
    const awards = renderAwards(fmt)
    const tiebreaker = renderTiebreaker(fmt, meta)

    return `
    <div class="ballot">
        <div class="header">
            <div class="header-top">
                <div>
                    <h1 class="tournament-name">${tournamentName}</h1>
                    ${caseName ? `<div class="case-name">${caseName}</div>` : ''}
                </div>
                <div class="header-meta">
                    ${roundName ? `<div><strong>${roundName}</strong></div>` : ''}
                    ${roundTime ? `<div>${roundTime}</div>` : ''}
                    <div>Courtroom: ${courtroom || '________'}</div>
                </div>
            </div>
            <div class="teams">
                <span class="team-line"><span class="team-role">${esc(prosLabel)}:</span> <span class="team-code">${pCode || '________'}</span></span>
                <span class="team-line"><span class="team-role">Defense:</span> <span class="team-code">${dCode || '________'}</span></span>
            </div>
            <div class="scorer-line">
                <span class="field"><span class="label">Scorer</span> <span class="value">&nbsp;</span></span>
            </div>
        </div>

        <div class="categories">${categories}</div>

        <div class="footer">
            ${awards}
            ${tiebreaker}
        </div>

        <div class="signature-line">
            <span class="field"><span class="label">Scorer Signature</span> <span class="value">&nbsp;</span></span>
        </div>
    </div>`
}

/**
 * Builds the full self-contained HTML document for a printable one-page ballot.
 * Exported for testing / preview; consumers normally call {@link downloadBallot}.
 */
export function buildBallotHtml(fmt: IScoreSheetFormat, meta: BallotMeta = {}): string {
    const pCode = esc(meta.prosecutionCode ?? fmt.prosecutionCode)
    const dCode = esc(meta.defenseCode ?? fmt.defenseCode)
    const title = `Ballot — ${pCode} v. ${dCode}`

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>${BALLOT_STYLES}</style>
</head>
<body>
${buildBallotInner(fmt, meta)}
</body>
</html>`
}

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
        /* Master size knob. Every text size below is expressed in em relative
           to this value, so setting --ballot-font uniformly scales the whole
           ballot. Defaults to the previous fixed 8.5px. */
        font-size: var(--ballot-font, 8.5px);
        line-height: 1.25;
    }

    .ballot .header { border-bottom: 2px solid #111; padding-bottom: 0.47em; margin-bottom: 0.7em; }
    .ballot .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .ballot .tournament-name { font-size: 1.53em; font-weight: 700; margin: 0; }
    .ballot .case-name { font-size: 1.06em; font-style: italic; color: #555; margin-top: 0.12em; }
    .ballot .header-meta { text-align: right; font-size: 0.94em; }
    .ballot .teams { display: flex; gap: 2.8em; margin-top: 0.47em; align-items: baseline; }
    .ballot .team-line { font-size: 1.53em; }
    .ballot .team-role { font-size: 1.06em; text-transform: uppercase; letter-spacing: 0.04em; color: #555; font-weight: 600; }
    .ballot .team-code { font-size: 1.53em; font-weight: 700; }

    .ballot .scorer-line { display: flex; gap: 1.9em; margin: 0.6em 0; font-size: 0.94em; }
    .ballot .field { flex: 1; }
    .ballot .field .label { color: #555; text-transform: uppercase; font-size: 0.82em; letter-spacing: 0.04em; }
    .ballot .field .value { border-bottom: 1px solid #999; display: inline-block; min-width: 10.6em; padding: 0 0.35em; }

    .ballot .categories { column-count: 2; column-gap: 1.2em; }
    .ballot .cat-table {
        width: 100%; border-collapse: collapse; margin-bottom: 0.6em;
        break-inside: avoid; page-break-inside: avoid;
    }
    .ballot .cat-heading th {
        color: #111; text-align: left; padding: 0.35em 0 0.24em;
        font-size: 1em; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.03em;
        border-top: 2px solid #111; border-bottom: 2px solid #111;
    }
    .ballot .col-heading th {
        border-bottom: 1px solid #111; padding: 0.12em 0.47em; font-size: 0.82em;
        text-transform: uppercase; color: #333; text-align: center;
    }
    .ballot .col-heading .assignment-col { text-align: left; }
    .ballot .cat-table td { padding: 0.24em 0.47em; border-bottom: 1px solid #ddd; vertical-align: top; }
    .ballot .cat-table td.assignment { width: 46%; }
    .ballot .cat-table .range { color: #888; font-size: 0.82em; }
    .ballot .score-cell { text-align: center; width: 27%; }
    .ballot .score-blank {
        display: inline-block; width: 3.05em; height: 1.53em;
        border: 1px solid #333; border-radius: 2px; vertical-align: middle;
    }
    .ballot .student { display: block; font-size: 0.76em; color: #444; margin-top: 0.12em; }

    .ballot .footer { margin-top: 0.7em; display: flex; gap: 1.4em; break-inside: avoid; }
    .ballot .signature-line {
        margin-top: 1.2em; display: flex; gap: 2.8em; break-inside: avoid;
        font-size: 0.94em; align-items: flex-end;
    }
    .ballot .signature-line .field { flex: 1; }
    .ballot .signature-line .field--date { flex: 0 0 15.3em; }
    .ballot .signature-line .value { display: block; border-bottom: 1px solid #333; min-width: 100%; height: 1.9em; }
    .ballot .awards { flex: 1.4; }
    .ballot .tiebreaker { flex: 1; border: 1px solid #111; padding: 0.47em 0.7em; }
    .ballot .section-title {
        font-size: 1em; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.04em; border-bottom: 1px solid #111;
        margin-bottom: 0.35em; padding-bottom: 0.12em;
    }
    .ballot .award { margin-bottom: 0.47em; }
    .ballot .award-name { font-size: 0.94em; font-weight: 600; }
    .ballot .award-hint { font-weight: 400; color: #777; font-size: 0.82em; }
    .ballot .award-blanks { display: block; margin-top: 0.24em; }
    .ballot .award-line {
        display: inline-block; border-bottom: 1px solid #333;
        height: 1.4em; min-width: 46%; margin: 0 2% 0.35em 0;
    }
    .ballot .tb-note { font-size: 0.82em; color: #555; margin-bottom: 0.47em; }
    .ballot .tb-option { display: block; font-size: 1em; margin-bottom: 0.47em; }
    .ballot .tb-box {
        display: inline-block; width: 1.3em; height: 1.3em;
        border: 1.5px solid #111; vertical-align: middle; margin-right: 0.47em;
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


/** CSS pixels per inch (browser standard for layout units). */
const PX_PER_IN = 96

/**
 * Usable printable area of a Letter portrait page after the 0.4in @page
 * margins on all sides: 8.5in × 11in minus 0.4in × 2.
 */
export const BALLOT_PAGE = {
    /** Usable content width in CSS pixels (7.7in). */
    width: (8.5 - 0.4 * 2) * PX_PER_IN,
    /** Usable content height in CSS pixels (10.2in). */
    height: (11 - 0.4 * 2) * PX_PER_IN,
} as const

/** Bounds for the auto-fit search, in CSS px for the ballot root font-size. */
const MIN_BALLOT_FONT = 6
const MAX_BALLOT_FONT = 48

/**
 * Finds the largest ballot root font-size (the `--ballot-font` value, in px)
 * that keeps the ballot content within a single printable page.
 *
 * The ballot's markup is rendered into a detached, fixed-width probe element
 * (matching the printable width) and its scrollHeight is measured while the
 * font-size is grown via binary search. Because every text size and text-paired
 * spacing in {@link BALLOT_STYLES} is expressed in `em` relative to the root
 * font-size, changing this single value scales the whole ballot proportionally.
 *
 * @param innerHtml The `.ballot` markup from {@link buildBallotInner}.
 * @param maxHeight Available page height in CSS px (defaults to a Letter page).
 * @returns The chosen font-size in px.
 */
export function fitBallotFontSize(
    innerHtml: string,
    maxHeight: number = BALLOT_PAGE.height,
    maxWidth: number = BALLOT_PAGE.width,
): number {
    // Probe container sized to the printable area, rendered off-screen.
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.position = 'fixed'
    probe.style.left = '-10000px'
    probe.style.top = '0'
    probe.style.width = `${maxWidth}px`
    probe.style.visibility = 'hidden'
    probe.style.pointerEvents = 'none'
    probe.innerHTML = innerHtml

    const ballotEl = probe.firstElementChild as HTMLElement | null
    document.body.appendChild(probe)

    const fitsAt = (fontPx: number): boolean => {
        if (!ballotEl) return true
        ballotEl.style.setProperty('--ballot-font', `${fontPx}px`)
        // Content fits if it does not exceed the usable page height. scrollHeight
        // captures overflow beyond the probe's own box.
        return ballotEl.scrollHeight <= maxHeight
    }

    try {
        // Binary search for the largest integer-ish font size that still fits.
        let lo = MIN_BALLOT_FONT
        let hi = MAX_BALLOT_FONT
        // If even the minimum overflows, just use the minimum.
        if (!fitsAt(lo)) return lo
        // 0.25px precision is well below a visible difference in print.
        while (hi - lo > 0.25) {
            const mid = (lo + hi) / 2
            if (fitsAt(mid)) lo = mid
            else hi = mid
        }
        return Math.floor(lo * 4) / 4 // round down to nearest 0.25px
    } finally {
        document.body.removeChild(probe)
    }
}

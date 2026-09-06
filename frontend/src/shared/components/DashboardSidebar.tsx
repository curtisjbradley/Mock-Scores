import {useState} from "react";

export interface DashboardNavItem<T extends string> {
    key: T
    label: string
    /** Icon node — typically an `<img>` of a designed SVG from `/icons/`. */
    icon: React.ReactNode
}

interface Props<T extends string> {
    items: DashboardNavItem<T>[]
    active: T
    onChange: (key: T) => void
    /** Title shown at the top of the sidebar (e.g. team code or tournament name). */
    title: string
    subtitle?: string
    /** Accessible label for the nav landmark. */
    ariaLabel?: string
}

/**
 * Generic collapsible left navigation rail used by the coach and organizer
 * dashboards.
 *
 * Expanded: fixed-width column with an icon + text label per item.
 * Collapsed: narrow rail showing only icons (labels available via title attr).
 *
 * Icons are designed SVGs served from `/icons/` (passed in as `<img>` nodes by
 * each dashboard). Styling lives in the shared `styles/dashboard.css`
 * (`.dash-sidebar*` / `.dash-nav-*` classes).
 */

const SIDEBAR_STORAGE_KEY = 'sidebar-storage-state'



export default function DashboardSidebar<T extends string>({
    items, active, onChange, title, subtitle,
    ariaLabel = 'Dashboard sections',
}: Props<T>) {

    const [collapsed, setCollapsed] = useState<boolean>(() => {
        try {
            return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
        } catch {
            return false
        }
    })
    const toggleCollapsed = () => {
        setCollapsed(prev => {
            const next = !prev
            try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)) } catch { /* ignore */ }
            return next
        })
    }

    return (
        <aside className={`dash-sidebar${collapsed ? ' dash-sidebar--collapsed' : ''}`}>
            <div className="dash-sidebar-head">
                {!collapsed && (
                    <div className="dash-sidebar-titles">
                        <span className="dash-sidebar-title">{title}</span>
                        {subtitle && <span className="dash-sidebar-subtitle">{subtitle}</span>}
                    </div>
                )}
                <button
                    type="button"
                    className="dash-sidebar-toggle"
                    onClick={toggleCollapsed}
                    aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                    aria-expanded={!collapsed}
                    title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                >
                    <img
                        src={collapsed ? '/icons/Expand.svg' : '/icons/Shrink.svg'}
                        alt=""
                        aria-hidden="true"
                    />
                </button>
            </div>

            <nav className="dash-sidebar-nav" aria-label={ariaLabel}>
                {items.map(item => (
                    <button
                        key={item.key}
                        type="button"
                        className={`dash-nav-item${active === item.key ? ' dash-nav-item--active' : ''}`}
                        onClick={() => onChange(item.key)}
                        aria-current={active === item.key ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                    >
                        <span className="dash-nav-icon" aria-hidden="true">{item.icon}</span>
                        {!collapsed && <span className="dash-nav-label">{item.label}</span>}
                    </button>
                ))}
            </nav>
        </aside>
    )
}

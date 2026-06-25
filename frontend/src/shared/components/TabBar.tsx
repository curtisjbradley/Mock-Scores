interface Tab<T extends string> {
    key: T
    label: string
}

interface Props<T extends string> {
    tabs: Tab<T>[]
    active: T
    onChange: (tab: T) => void
    className?: string
}

/** Config-driven horizontal tab bar using the `dash-tab` CSS classes. */
export default function TabBar<T extends string>({ tabs, active, onChange, className = 'dash-tabs' }: Props<T>) {
    return (
        <div className={className}>
            {tabs.map(t => (
                <button
                    key={t.key}
                    className={`dash-tab${active === t.key ? ' dash-tab--active' : ''}`}
                    onClick={() => onChange(t.key)}
                >
                    {t.label}
                </button>
            ))}
        </div>
    )
}

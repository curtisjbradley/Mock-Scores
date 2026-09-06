import './styles/icon.css'

interface IconProps {
    /** SVG name (without extension) in `public/icons/`, e.g. "Overview". */
    name: string
    /**
     * Box size. Accepts any CSS length; a bare number is treated as `rem`.
     * Defaults to `1.25rem`.
     */
    size?: number | string
    /** Extra class names to merge onto the icon element. */
    className?: string
    /**
     * Accessible label. When provided, the icon is exposed to assistive tech
     * with this label; otherwise it is hidden (`aria-hidden`) as decoration.
     */
    label?: string
}

/**
 * Renders a designed SVG from `public/icons/` as a CSS mask so the glyph takes
 * the current text color (`color: var(--text)` by default via `.app-icon`).
 * Using a mask — rather than an `<img>` — lets a single monochrome asset recolor
 * with the theme and inherit `currentColor` from its context (hover states, etc.).
 */
export default function Icon({ name, size, className, label }: IconProps) {
    const dimension = typeof size === 'number' ? `${size}rem` : size
    const maskUrl = `url(/icons/${name}.svg)`

    return (
        <span
            className={`app-icon${className ? ` ${className}` : ''}`}
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
            style={{
                maskImage: maskUrl,
                WebkitMaskImage: maskUrl,
                ...(dimension ? { width: dimension, height: dimension } : {}),
            }}
        />
    )
}

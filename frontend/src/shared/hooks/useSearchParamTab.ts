import { useSearchParams } from 'react-router-dom'

/**
 * Syncs a tab key with the `page` search param.
 * Returns the current tab and a setter that updates the URL.
 */
export function useSearchParamTab<T extends string>(
    defaultTab: T,
    validTabs: ReadonlySet<string>,
): [T, (tab: T) => void] {
    const [searchParams, setSearchParams] = useSearchParams()
    const param = searchParams.get('page') ?? defaultTab
    const current = validTabs.has(param) ? (param as T) : defaultTab

    const setTab = (tab: T) => {
        if (tab === defaultTab) setSearchParams({}, { replace: true })
        else setSearchParams({ page: tab }, { replace: true })
    }

    return [current, setTab]
}

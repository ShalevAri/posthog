import { HeatmapFilters } from 'lib/components/heatmaps/types'

export enum PostHogAppToolbarEvent {
    PH_TOOLBAR_INIT = 'ph-toolbar-init',
    PH_TOOLBAR_READY = 'ph-toolbar-ready',
    PH_APP_INIT = 'ph-app-init',
    PH_HEATMAPS_CONFIG = 'ph-heatmaps-config',
    PH_PATCH_HEATMAP_FILTERS = 'ph-patch-heatmap-filters',
    PH_HEATMAPS_FIXED_POSITION_MODE = 'ph-heatmaps-fixed-position-mode',
    PH_HEATMAPS_COLOR_PALETTE = 'ph-heatmaps-color-palette',
}

export const DEFAULT_HEATMAP_FILTERS: HeatmapFilters = {
    enabled: true,
    type: 'click',
    viewportAccuracy: 0.9,
    aggregation: 'total_count',
}
export const calculateViewportRange = (
    heatmapFilters: HeatmapFilters,
    windowWidth: number
): { max: number; min: number } => {
    const viewportAccuracy = heatmapFilters.viewportAccuracy ?? 0.2
    const extraPixels = windowWidth - windowWidth * viewportAccuracy

    const minWidth = Math.max(0, windowWidth - extraPixels)
    const maxWidth = windowWidth + extraPixels

    return {
        min: Math.round(minWidth),
        max: Math.round(maxWidth),
    }
}

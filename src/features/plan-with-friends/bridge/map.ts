// Map styling pulls in MapLibre (about 1 MB): kept apart from bridge/ui so only the lazily loaded room map downloads it.
export { ensureWorker, keepAttributionCollapsed, resolveMissingStyleImages, STYLES, useDarkScheme } from "@/components/map/mapStyle";

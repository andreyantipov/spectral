/**
 * Thin re-export — the actual EventBus command dispatch lives in
 * domain.service.browsing where it belongs (service layer).
 *
 * Desktop app only needs the Layer for DI composition.
 */
export { BrowsingServiceLive as EventBridgeLive } from "@ctrl/domain.service.browsing";

// The RPC group (BrowsingRpcs) is the canonical service contract.
// The handler layer (BrowsingHandlersLive) is the canonical implementation.
// The old BrowsingService Context.Tag has been removed.

export { BrowsingHandlersLive } from "./browsing.handlers";
export { BrowsingRpcs } from "./browsing.rpc";

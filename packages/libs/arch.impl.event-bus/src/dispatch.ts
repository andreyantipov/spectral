import type { EventBus } from "@ctrl/arch.contract.event-bus";
import type { Context } from "effect";

type EventBusService = Context.Tag.Service<typeof EventBus>;

/**
 * Generic typed dispatch helper.
 * Usage: `typedSend(bus)("ws.activate-panel", { panelId })`
 * The caller provides tag and payload as plain strings/objects.
 * Type safety is enforced at the call site by the consumer's EventGroup types.
 */
export const typedSend = (bus: EventBusService) => (tag: string, payload: unknown) =>
	bus.send({
		type: "command" as const,
		action: tag,
		payload,
		meta: { source: "system" as const },
	});

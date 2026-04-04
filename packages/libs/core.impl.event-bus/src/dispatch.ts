import type { AppEvents, EventBus } from "@ctrl/core.contract.event-bus";
import type { Event } from "@effect/experimental/Event";
import type { EventGroup } from "@effect/experimental/EventGroup";
import type { Context } from "effect";

/** All event tags from AppEvents — union of all possible tags */
type AllTags = Event.Tag<EventGroup.Events<(typeof AppEvents)["groups"][number]>>;

/** Payload for a specific tag */
type PayloadFor<T extends AllTags> = Event.PayloadWithTag<
	EventGroup.Events<(typeof AppEvents)["groups"][number]>,
	T
>;

type EventBusService = Context.Tag.Service<typeof EventBus>;

export const typedSend =
	(bus: EventBusService) =>
	<T extends AllTags>(tag: T, payload: PayloadFor<T>) =>
		bus.send({
			type: "command" as const,
			action: tag,
			payload,
			meta: { source: "system" as const },
		});

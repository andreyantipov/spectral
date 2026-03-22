import { Effect } from "effect";
import { EventBus } from "./event-bus.port";
import { EventBusRpcs } from "./event-bus.rpc";

export const EventBusHandlersLive = EventBusRpcs.toLayer(
	Effect.gen(function* () {
		const bus = yield* EventBus;

		return {
			dispatch: ({ command }) => bus.send(command),
			eventStream: () => bus.events,
		};
	}),
);

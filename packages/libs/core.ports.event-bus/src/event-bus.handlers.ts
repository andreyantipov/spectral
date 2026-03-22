import { Effect } from "effect";
import { EventBusRpcs } from "./event-bus.rpc";
import { EventBus } from "./index";

export const EventBusHandlersLive = EventBusRpcs.toLayer(
	Effect.gen(function* () {
		const bus = yield* EventBus;

		return {
			dispatch: ({ command }) => bus.send(command),
			eventStream: () => bus.events,
		};
	}),
);

import { type AppCommand, type AppEvent, EventBus } from "@ctrl/core.contract.event-bus";
import { Effect, Layer, PubSub, Stream } from "effect";

export const EventBusLive = Layer.effect(
	EventBus,
	Effect.gen(function* () {
		const commandPub = yield* PubSub.unbounded<AppCommand>();
		const eventPub = yield* PubSub.unbounded<AppEvent>();

		return {
			send: (cmd: AppCommand) => PubSub.publish(commandPub, cmd).pipe(Effect.asVoid),
			publish: (evt: AppEvent) => PubSub.publish(eventPub, evt).pipe(Effect.asVoid),
			commands: Stream.fromPubSub(commandPub),
			events: Stream.fromPubSub(eventPub),
			on: (name: string) => {
				const isWildcard = name.endsWith(".*");
				const prefix = isWildcard ? name.slice(0, -1) : null;
				return Stream.fromPubSub(eventPub).pipe(
					Stream.filter((e) => (prefix ? e.name.startsWith(prefix) : e.name === name)),
				);
			},
		};
	}),
);

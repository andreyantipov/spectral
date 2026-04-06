import { type AppCommand, type AppEvent, type JournalEntry, EventBus } from "@ctrl/core.contract.event-bus";
import { Effect, Layer, PubSub, Stream } from "effect";

export const EventBusLive = Layer.effect(
	EventBus,
	Effect.gen(function* () {
		const commandPub = yield* PubSub.unbounded<AppCommand>();
		const eventPub = yield* PubSub.unbounded<AppEvent>();
		const journalPub = yield* PubSub.unbounded<JournalEntry>();

		return {
			send: (cmd: AppCommand) =>
				Effect.gen(function* () {
					yield* PubSub.publish(commandPub, cmd);
					yield* PubSub.publish(journalPub, {
						id: crypto.randomUUID(),
						action: cmd.action,
						payload: cmd.payload,
						timestamp: Date.now(),
					});
				}).pipe(Effect.asVoid),
			publish: (evt: AppEvent) => PubSub.publish(eventPub, evt).pipe(Effect.asVoid),
			commands: Stream.fromPubSub(commandPub),
			events: Stream.fromPubSub(eventPub),
			journal: Stream.fromPubSub(journalPub),
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

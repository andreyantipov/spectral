import { Context, type Effect, type Stream } from "effect";

export type CommandSource = "keyboard" | "menu" | "agent" | "ui" | "system";

export type AppCommand = {
	readonly type: "command";
	readonly action: string;
	readonly payload?: unknown;
	readonly meta?: { readonly source: CommandSource };
};

export type AppEvent = {
	readonly type: "event";
	readonly name: string;
	readonly payload?: unknown;
	readonly timestamp: number;
	readonly causedBy?: string;
};

export const EVENT_BUS_ID = "EventBus" as const;

export class EventBus extends Context.Tag(EVENT_BUS_ID)<
	EventBus,
	{
		readonly send: (command: AppCommand) => Effect.Effect<void>;
		readonly publish: (event: AppEvent) => Effect.Effect<void>;
		readonly commands: Stream.Stream<AppCommand>;
		readonly events: Stream.Stream<AppEvent>;
		readonly on: (eventName: string) => Stream.Stream<AppEvent>;
	}
>() {}

export { EventBusLive } from "./event-bus.live";

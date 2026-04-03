import { TerminalEvents } from "@ctrl/core.contract.event-bus";
import { TerminalFeature } from "@ctrl/domain.feature.terminal";
import { EventLog } from "@effect/experimental";
import { Effect } from "effect";

export const TerminalHandlers = EventLog.group(TerminalEvents, (h) =>
	h
		.handle("term.create", ({ payload }) =>
			Effect.gen(function* () {
				const feature = yield* TerminalFeature;
				return yield* feature.create(payload);
			}),
		)
		.handle("term.resize", ({ payload }) =>
			Effect.gen(function* () {
				const feature = yield* TerminalFeature;
				yield* feature.resize(payload.id, payload.cols, payload.rows);
			}),
		)
		.handle("term.close", ({ payload }) =>
			Effect.gen(function* () {
				const feature = yield* TerminalFeature;
				yield* feature.close(payload.id);
			}),
		),
);

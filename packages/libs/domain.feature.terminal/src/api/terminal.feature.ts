import { withTracing } from "@ctrl/base.tracing";
import { TerminalError, type TerminalInfo, TerminalPort } from "@ctrl/core.contract.terminal";
import { Context, Effect, Layer } from "effect";
import { TERMINAL_FEATURE } from "../lib/constants";

export class TerminalFeature extends Context.Tag(TERMINAL_FEATURE)<
	TerminalFeature,
	{
		readonly create: (opts: {
			shell?: string;
			cwd?: string;
		}) => Effect.Effect<{ id: string }, TerminalError>;
		readonly resize: (id: string, cols: number, rows: number) => Effect.Effect<void, TerminalError>;
		readonly close: (id: string) => Effect.Effect<void, TerminalError>;
		readonly list: () => Effect.Effect<TerminalInfo[]>;
	}
>() {}

export const TerminalFeatureLive = Layer.effect(
	TerminalFeature,
	Effect.gen(function* () {
		const port = yield* TerminalPort;
		const registry = new Map<string, TerminalInfo>();

		const lookupOrFail = (id: string) => {
			const info = registry.get(id);
			if (!info) {
				return Effect.fail(
					new TerminalError({
						reason: "not-found",
						terminalId: id,
						message: `Terminal ${id} not found`,
					}),
				);
			}
			return Effect.succeed(info);
		};

		return withTracing(TERMINAL_FEATURE, {
			create: (opts: { shell?: string; cwd?: string }) =>
				Effect.gen(function* () {
					const { id } = yield* port.spawn(opts);
					registry.set(id, {
						id,
						shell: opts.shell ?? "/bin/sh",
						cwd: opts.cwd ?? "/",
						cols: 80,
						rows: 24,
						createdAt: Date.now(),
					});
					return { id };
				}),

			resize: (id: string, cols: number, rows: number) =>
				Effect.gen(function* () {
					const info = yield* lookupOrFail(id);
					yield* port.resize(id, cols, rows);
					registry.set(id, { ...info, cols, rows });
				}),

			close: (id: string) =>
				Effect.gen(function* () {
					yield* lookupOrFail(id);
					yield* port.close(id);
					registry.delete(id);
				}),

			list: () => Effect.succeed([...registry.values()]),
		});
	}),
);

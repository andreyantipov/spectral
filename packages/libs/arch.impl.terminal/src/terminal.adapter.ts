import { TerminalError } from "@ctrl/base.error";
import { TerminalPort } from "@ctrl/arch.contract.terminal";
import { Effect, Layer, PubSub, Stream } from "effect";

const ALLOWED_SHELLS_FALLBACK = new Set([
	"/bin/sh",
	"/bin/bash",
	"/bin/zsh",
	"/usr/bin/fish",
	"/bin/fish",
]);

const isValidShell = (shell: string) =>
	Effect.tryPromise(() => Bun.file("/etc/shells").text()).pipe(
		Effect.map((text) => {
			const shells = new Set(
				text
					.split("\n")
					.map((s) => s.trim())
					.filter((s) => s && !s.startsWith("#")),
			);
			return shells.has(shell);
		}),
		Effect.orElseSucceed(() => ALLOWED_SHELLS_FALLBACK.has(shell)),
	);

type TerminalEntry = {
	process: ReturnType<typeof Bun.spawn>;
	output: PubSub.PubSub<Uint8Array>;
	closed: boolean;
};

export const TerminalAdapterLive = Layer.effect(
	TerminalPort,
	Effect.gen(function* () {
		const terminals = new Map<string, TerminalEntry>();

		const lookup = (id: string) => {
			const entry = terminals.get(id);
			if (!entry) {
				return Effect.fail(
					new TerminalError({
						reason: "not-found",
						terminalId: id,
						message: `Terminal ${id} not found`,
					}),
				);
			}
			if (entry.closed) {
				return Effect.fail(
					new TerminalError({
						reason: "already-closed",
						terminalId: id,
						message: `Terminal ${id} is closed`,
					}),
				);
			}
			return Effect.succeed(entry);
		};

		return {
			spawn: (opts) =>
				Effect.gen(function* () {
					const id = crypto.randomUUID();
					const output = yield* PubSub.sliding<Uint8Array>(256);
					const shell = opts.shell ?? process.env.SHELL ?? "/bin/sh";
					const cwd = opts.cwd ?? process.cwd();

					// Pre-validate shell exists to avoid Bun.spawn crash on invalid path
					const shellFile = Bun.file(shell);
					const shellExists = yield* Effect.tryPromise({
						try: () => shellFile.exists(),
						catch: () =>
							new TerminalError({
								reason: "spawn-failed",
								message: `Cannot verify shell: ${shell}`,
							}),
					});
					if (!shellExists) {
						return yield* Effect.fail(
							new TerminalError({
								reason: "spawn-failed",
								message: `Shell not found: ${shell}`,
							}),
						);
					}

					if (!(yield* isValidShell(shell))) {
						return yield* Effect.fail(
							new TerminalError({
								reason: "spawn-failed",
								message: `Shell not in /etc/shells: ${shell}`,
							}),
						);
					}

					const proc = Bun.spawn([shell], {
						cwd,
						terminal: {
							cols: 80,
							rows: 24,
							data(_terminal, data) {
								Effect.runFork(PubSub.publish(output, new Uint8Array(data)));
							},
							exit() {
								const entry = terminals.get(id);
								if (entry) entry.closed = true;
							},
						},
					});

					terminals.set(id, { process: proc, output, closed: false });
					return { id };
				}).pipe(
					Effect.catchAllDefect((e) =>
						Effect.fail(new TerminalError({ reason: "spawn-failed", message: String(e) })),
					),
				),

			write: (id, data) =>
				Effect.gen(function* () {
					const entry = yield* lookup(id);
					entry.process.terminal?.write(data);
				}),

			resize: (id, cols, rows) =>
				Effect.gen(function* () {
					const entry = yield* lookup(id);
					entry.process.terminal?.resize(cols, rows);
				}),

			close: (id) =>
				Effect.gen(function* () {
					const entry = yield* lookup(id);
					entry.closed = true;
					entry.process.terminal?.close();
					entry.process.kill();
					yield* PubSub.shutdown(entry.output);
					terminals.delete(id);
				}),

			output: (id) => {
				const entry = terminals.get(id);
				if (!entry)
					return Stream.fail(
						new TerminalError({
							reason: "not-found",
							terminalId: id,
							message: `Terminal ${id} not found`,
						}),
					);
				return Stream.fromPubSub(entry.output);
			},
		};
	}),
);

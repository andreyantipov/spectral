import { describe, expect, it } from "bun:test";
import { TerminalPort } from "@ctrl/core.contract.terminal";
import { Chunk, Effect, Stream } from "effect";
import { TerminalAdapterLive } from "./terminal.adapter";

const runWithAdapter = <A, E>(effect: Effect.Effect<A, E, TerminalPort>) =>
	Effect.runPromise(Effect.provide(effect, TerminalAdapterLive));

describe("TerminalAdapterLive", () => {
	it("spawns a terminal and receives output", async () => {
		await runWithAdapter(
			Effect.gen(function* () {
				const port = yield* TerminalPort;
				const { id } = yield* port.spawn({ shell: "/bin/sh" });
				expect(id).toBeTruthy();

				// Small delay to let the shell initialize
				yield* Effect.sleep("100 millis");

				// Write command and collect output
				yield* port.write(id, "echo hello-test\n");

				const chunks = yield* port.output(id).pipe(
					Stream.takeUntil((chunk) => new TextDecoder().decode(chunk).includes("hello-test")),
					Stream.runCollect,
				);
				const text = Chunk.toArray(chunks)
					.map((c) => new TextDecoder().decode(c))
					.join("");
				expect(text).toContain("hello-test");

				yield* port.close(id);
			}),
		);
	});

	it("returns spawn-failed for invalid shell", async () => {
		await runWithAdapter(
			Effect.gen(function* () {
				const port = yield* TerminalPort;
				const exit = yield* port.spawn({ shell: "/nonexistent" }).pipe(Effect.either);
				expect(exit._tag).toBe("Left");
			}),
		);
	});

	it("returns not-found for invalid terminal id", async () => {
		await runWithAdapter(
			Effect.gen(function* () {
				const port = yield* TerminalPort;
				const exit = yield* port.write("nonexistent", "data").pipe(Effect.either);
				expect(exit._tag).toBe("Left");
			}),
		);
	});
});

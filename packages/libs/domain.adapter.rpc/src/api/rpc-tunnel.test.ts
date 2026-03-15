import * as Rpc from "@effect/rpc/Rpc";
import * as RpcClient from "@effect/rpc/RpcClient";
import * as RpcGroup from "@effect/rpc/RpcGroup";
import * as RpcSerialization from "@effect/rpc/RpcSerialization";
import * as RpcServer from "@effect/rpc/RpcServer";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import { describe, expect, it } from "vitest";
import type { ElectrobunRpcHandle } from "../model/electrobun-rpc.js";
import { ElectrobunClientProtocol } from "./client-protocol.js";
import { ElectrobunServerProtocol } from "./server-protocol.js";

// ---------------------------------------------------------------------------
// Mock Electrobun: two connected handles that simulate IPC
// ---------------------------------------------------------------------------

function createMockElectrobunPair(): {
	bunSide: ElectrobunRpcHandle;
	webviewSide: ElectrobunRpcHandle;
} {
	const listeners: Record<string, Array<(data: unknown) => void>> = {};

	const bunSide: ElectrobunRpcHandle = {
		send: new Proxy({} as Record<string, (payload: unknown) => void>, {
			get: (_, channel: string) => (data: unknown) => {
				const key = `webview:${channel}`;
				listeners[key]?.forEach((h) => {
					h(data);
				});
			},
		}),
		addMessageListener: (channel, handler) => {
			const key = `bun:${channel}`;
			listeners[key] = listeners[key] ?? [];
			listeners[key].push(handler);
		},
	};

	const webviewSide: ElectrobunRpcHandle = {
		send: new Proxy({} as Record<string, (payload: unknown) => void>, {
			get: (_, channel: string) => (data: unknown) => {
				const key = `bun:${channel}`;
				listeners[key]?.forEach((h) => {
					h(data);
				});
			},
		}),
		addMessageListener: (channel, handler) => {
			const key = `webview:${channel}`;
			listeners[key] = listeners[key] ?? [];
			listeners[key].push(handler);
		},
	};

	return { bunSide, webviewSide };
}

// ---------------------------------------------------------------------------
// Test RPC definitions
// ---------------------------------------------------------------------------

const Echo = Rpc.make("Echo", {
	payload: { message: Schema.String },
	success: Schema.String,
});

const Add = Rpc.make("Add", {
	payload: { a: Schema.Number, b: Schema.Number },
	success: Schema.Number,
});

const CountUp = Rpc.make("CountUp", {
	payload: { from: Schema.Number, to: Schema.Number },
	success: Schema.Number,
	stream: true,
});

const TestGroup = RpcGroup.make(Echo, Add, CountUp);

// ---------------------------------------------------------------------------
// Handler implementations via group.toLayer
// ---------------------------------------------------------------------------

const HandlersLive = TestGroup.toLayer({
	Echo: ({ message }) => Effect.succeed(message),
	Add: ({ a, b }) => Effect.succeed(a + b),
	CountUp: ({ from, to }) => Stream.range(from, to).pipe(Stream.map((n) => n)),
});

// ---------------------------------------------------------------------------
// Helper: wire server + client through mock Electrobun pair
// ---------------------------------------------------------------------------

const makeTestLayer = () => {
	const { bunSide, webviewSide } = createMockElectrobunPair();

	const SerializationLive = RpcSerialization.layerJson;

	const ServerProtocolLive = Layer.scoped(
		RpcServer.Protocol,
		ElectrobunServerProtocol(bunSide),
	).pipe(Layer.provide(SerializationLive));

	// Use RpcServer.layer which properly forks the server
	const ServerLive = RpcServer.layer(TestGroup).pipe(
		Layer.provide(ServerProtocolLive),
		Layer.provide(HandlersLive),
	);

	const ClientProtocolLive = Layer.scoped(
		RpcClient.Protocol,
		ElectrobunClientProtocol(webviewSide),
	).pipe(Layer.provide(SerializationLive));

	return Layer.mergeAll(ClientProtocolLive, ServerLive);
};

const runTest = <A, E>(effect: Effect.Effect<A, E, RpcClient.Protocol | Scope.Scope>) =>
	Effect.runPromise(Effect.scoped(effect).pipe(Effect.provide(makeTestLayer())));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Electrobun RPC tunnel", () => {
	it("echo: sends a string and receives it back", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(TestGroup);
				return yield* client.Echo({ message: "hello" });
			}),
		);
		expect(result).toBe("hello");
	});

	it("add: sends two numbers and receives their sum", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(TestGroup);
				return yield* client.Add({ a: 3, b: 4 });
			}),
		);
		expect(result).toBe(7);
	});

	it("countUp: streams a range of numbers", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(TestGroup);
				return yield* client.CountUp({ from: 1, to: 5 }).pipe(
					Stream.runCollect,
					Effect.map((chunk) => Array.from(chunk)),
				);
			}),
		);
		expect(result).toEqual([1, 2, 3, 4, 5]);
	});
});

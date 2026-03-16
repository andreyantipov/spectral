import type { AppCommand } from "@ctrl/core.shared";
import { describe, expect, it } from "vitest";
import { createIpcBridge } from "./ipc-bridge";

const createMockHandle = () => {
	const listeners = new Map<string, (data: unknown) => void>();
	const sent: Array<{ channel: string; data: unknown }> = [];

	return {
		handle: {
			send: new Proxy({} as Record<string, (payload: unknown) => void>, {
				get: (_target, channel: string) => {
					return (payload: unknown) => {
						sent.push({ channel, data: payload });
						// Echo back to simulate the other side receiving
						const listener = listeners.get(channel);
						if (listener) listener(payload);
					};
				},
			}),
			addMessageListener: (channel: string, handler: (data: unknown) => void) => {
				listeners.set(channel, handler);
			},
		},
		sent,
	};
};

describe("createIpcBridge", () => {
	it("send transmits command on app-commands channel", () => {
		const { handle, sent } = createMockHandle();
		const bridge = createIpcBridge(handle);

		bridge.send({ type: "toggle-command-center" });

		expect(sent).toHaveLength(1);
		expect(sent[0].channel).toBe("app-commands");
		expect(sent[0].data).toEqual({ type: "toggle-command-center" });
	});

	it("subscribe receives commands", () => {
		const { handle } = createMockHandle();
		const bridge = createIpcBridge(handle);

		const received: AppCommand[] = [];
		bridge.subscribe((cmd) => received.push(cmd));

		bridge.send({ type: "toggle-command-center" });

		expect(received).toHaveLength(1);
		expect(received[0].type).toBe("toggle-command-center");
	});

	it("unsubscribe stops receiving", () => {
		const { handle } = createMockHandle();
		const bridge = createIpcBridge(handle);

		const received: AppCommand[] = [];
		const unsub = bridge.subscribe((cmd) => received.push(cmd));

		bridge.send({ type: "toggle-command-center" });
		unsub();
		bridge.send({ type: "toggle-command-center" });

		expect(received).toHaveLength(1);
	});

	it("multiple subscribers all receive", () => {
		const { handle } = createMockHandle();
		const bridge = createIpcBridge(handle);

		const a: AppCommand[] = [];
		const b: AppCommand[] = [];
		bridge.subscribe((cmd) => a.push(cmd));
		bridge.subscribe((cmd) => b.push(cmd));

		bridge.send({ type: "toggle-command-center" });

		expect(a).toHaveLength(1);
		expect(b).toHaveLength(1);
	});

	it("handles notify command with payload", () => {
		const { handle } = createMockHandle();
		const bridge = createIpcBridge(handle);

		const received: AppCommand[] = [];
		bridge.subscribe((cmd) => received.push(cmd));

		bridge.send({ type: "notify", level: "success", title: "Test", description: "It works" });

		expect(received).toHaveLength(1);
		const cmd = received[0];
		expect(cmd.type).toBe("notify");
		if (cmd.type === "notify") {
			expect(cmd.level).toBe("success");
			expect(cmd.title).toBe("Test");
		}
	});
});

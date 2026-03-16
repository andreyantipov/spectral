import type { AppCommand } from "@ctrl/core.shared";
import type { ElectrobunHandle } from "../model/handle";

const CHANNEL = "app-commands";

export const createIpcBridge = (handle: ElectrobunHandle) => {
	const subscribers = new Set<(command: AppCommand) => void>();

	// Listen for commands from the other process
	handle.addMessageListener(CHANNEL, (raw) => {
		const command = raw as AppCommand;
		for (const handler of subscribers) {
			handler(command);
		}
	});

	return {
		send: (command: AppCommand): void => {
			handle.send[CHANNEL](command);
		},
		subscribe: (handler: (command: AppCommand) => void): (() => void) => {
			subscribers.add(handler);
			return () => {
				subscribers.delete(handler);
			};
		},
	};
};

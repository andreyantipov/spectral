/**
 * Structural type matching Electrobun's IPC message API.
 * No Electrobun imports needed — any object with this shape will work.
 */
export type ElectrobunHandle = {
	readonly send: Record<string, (payload: unknown) => void>;
	readonly addMessageListener: (channel: string, handler: (data: unknown) => void) => void;
};

export type ElectrobunIpcHandle = {
	readonly send: Record<string, (payload: unknown) => void>;
	readonly addMessageListener: (channel: string, handler: (data: unknown) => void) => void;
};

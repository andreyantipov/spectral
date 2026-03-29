import { Context, type Layer } from "effect";

/**
 * Carrier port — transport interface between processes.
 *
 * Carrier handles serialization and process boundary crossing.
 * Business code never touches carrier directly — it speaks EventBus.
 *
 * Implementations:
 * - domain.adapter.carrier (Electrobun IPC + Effect RPC)
 */

export type CarrierServerConfig = {
	readonly handle: unknown;
};

export type CarrierClientConfig = {
	readonly handle: unknown;
};

export class CarrierServer extends Context.Tag("CarrierServer")<
	CarrierServer,
	{
		readonly createServerProtocol: (handle: unknown) => Layer.Layer<never, never, never>;
	}
>() {}

export class CarrierClient extends Context.Tag("CarrierClient")<
	CarrierClient,
	{
		readonly createClientProtocol: (handle: unknown) => Layer.Layer<never, never, never>;
	}
>() {}

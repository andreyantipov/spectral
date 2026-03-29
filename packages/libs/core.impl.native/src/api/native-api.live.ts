import { withTracing } from "@ctrl/base.tracing";
import { NativeApi, type OpenDialogOpts } from "@ctrl/core.contract.native";
import { Effect, Layer } from "effect";

export const NativeApiLive = (win: {
	readonly setTitle: (title: string) => void;
	readonly minimize: () => void;
	readonly close: () => void;
}) =>
	Layer.succeed(
		NativeApi,
		withTracing("NativeApi", {
			clipboard: {
				read: () => Effect.succeed(""),
				write: (_text: string) => Effect.void,
			},
			shell: {
				openExternal: (_url: string) => Effect.void,
			},
			dialog: {
				showOpen: (_opts: OpenDialogOpts) => Effect.succeed([]),
			},
			window: {
				setTitle: (title: string) => Effect.sync(() => win.setTitle(title)),
				minimize: () => Effect.sync(() => win.minimize()),
				close: () => Effect.sync(() => win.close()),
			},
		}),
	);

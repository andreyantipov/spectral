import { Context, type Effect } from "effect";

export type OpenDialogOpts = {
	readonly title?: string;
	readonly filters?: readonly { name: string; extensions: string[] }[];
	readonly multiple?: boolean;
};

export class NativeApi extends Context.Tag("NativeApi")<
	NativeApi,
	{
		readonly clipboard: {
			readonly read: () => Effect.Effect<string>;
			readonly write: (text: string) => Effect.Effect<void>;
		};
		readonly shell: {
			readonly openExternal: (url: string) => Effect.Effect<void>;
		};
		readonly dialog: {
			readonly showOpen: (opts: OpenDialogOpts) => Effect.Effect<string[]>;
		};
		readonly window: {
			readonly setTitle: (title: string) => Effect.Effect<void>;
			readonly minimize: () => Effect.Effect<void>;
			readonly close: () => Effect.Effect<void>;
		};
	}
>() {}

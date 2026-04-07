import type { Spec } from "@ctrl/arch.contract.spec";
import { Context, type Effect } from "effect";

export class SpecRegistry extends Context.Tag("SpecRegistry")<
	SpecRegistry,
	{
		readonly register: (spec: Spec) => Effect.Effect<void>;
		readonly describe: () => Effect.Effect<readonly Spec[]>;
	}
>() {}

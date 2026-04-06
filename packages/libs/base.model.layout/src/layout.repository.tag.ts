import type { DatabaseError } from "@ctrl/base.error";
import type { PersistedLayout } from "@ctrl/base.schema";
import { Context, type Effect } from "effect";

export const LAYOUT_REPOSITORY_ID = "LayoutRepository" as const;

export class LayoutRepository extends Context.Tag(LAYOUT_REPOSITORY_ID)<
	LayoutRepository,
	{
		readonly getLayout: () => Effect.Effect<PersistedLayout | null, DatabaseError>;
		readonly saveLayout: (layout: PersistedLayout) => Effect.Effect<void, DatabaseError>;
	}
>() {}

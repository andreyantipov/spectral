import { WorkspaceEvents } from "@ctrl/core.contract.event-bus";
import type { LayoutNode } from "@ctrl/domain.feature.layout";
import {
	findAndMovePanel,
	findAndRemovePanel,
	findAndSplitPanel,
	insertPanelIntoGroup,
	LayoutFeature,
} from "@ctrl/domain.feature.layout";
import { EventLog } from "@effect/experimental";
import { Effect } from "effect";

// -- Workspace EventLog handlers ----------------------------------------------

export const WorkspaceHandlers = EventLog.group(WorkspaceEvents, (h) =>
	h
		.handle("ws.update-layout", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				// TODO(Task 3): update EventBus schema to use PersistedLayout directly
				const persisted = {
					version: 2 as const,
					root: payload.layout.dockviewState as LayoutNode,
				};
				yield* layout.updateLayout(persisted);
			}),
		)
		.handle("ws.split-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const updated = findAndSplitPanel(
					current,
					payload.panelId,
					payload.direction,
					payload.newPanel,
				);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.move-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const { node: stripped, panel } = findAndMovePanel(current, payload.panelId);
				if (!panel || !stripped) return;
				const updated = insertPanelIntoGroup(stripped, payload.targetGroupId, panel);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.close-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const { node } = findAndRemovePanel(current, payload.panelId);
				if (!node) return;
				yield* layout.updateLayout({ version: 2, root: node });
			}),
		),
);

import { WorkspaceEvents } from "@ctrl/core.contract.event-bus";
import {
	findAndActivatePanel,
	findAndMovePanel,
	findAndRemovePanel,
	findAndReorderPanel,
	findAndResize,
	findAndSplitPanel,
	findAndUpdateTabMeta,
	findFirstGroupId,
	insertPanelIntoGroup,
	LayoutFeature,
} from "@ctrl/feature.workspace.layout";
import { EventLog } from "@effect/experimental";
import { Effect } from "effect";

// -- Workspace EventLog handlers ----------------------------------------------

export const WorkspaceHandlers = EventLog.group(WorkspaceEvents, (h) =>
	h
		.handle("ws.update-layout", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				yield* layout.updateLayout(payload.layout);
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
		)
		.handle("ws.resize", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const updated = findAndResize(current, payload.splitId, payload.sizes);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.activate-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const updated = findAndActivatePanel(current, payload.panelId);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.reorder-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const updated = findAndReorderPanel(
					current,
					payload.groupId,
					payload.panelId,
					payload.index,
				);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.add-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				// __auto__ = find first group in tree
				let groupId = payload.groupId;
				if (groupId === "__auto__") {
					groupId = findFirstGroupId(current) ?? current.id;
				}
				const updated = insertPanelIntoGroup(current, groupId, payload.panel);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.update-tab-meta", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const updated = findAndUpdateTabMeta(current, payload.panelId, {
					title: payload.title,
					icon: payload.icon,
				});
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		),
);

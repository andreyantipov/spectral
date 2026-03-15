import { withTracing } from "@ctrl/core.shared";
import { SessionFeature } from "@ctrl/domain.feature.session";
import { Effect, Stream } from "effect";
import { BROWSING_SERVICE } from "../lib/constants";
import type { BrowsingState } from "../model/browsing.events";
import { BrowsingRpcs } from "./browsing.rpc";

export const BrowsingHandlersLive = BrowsingRpcs.toLayer(
	Effect.gen(function* () {
		const sessions = yield* SessionFeature;

		return withTracing(BROWSING_SERVICE, {
			createSession: ({ mode }: { readonly mode: "visual" }) =>
				sessions.create(mode).pipe(Effect.tap((s) => sessions.setActive(s.id))),
			removeSession: ({ id }: { readonly id: string }) => sessions.remove(id),
			navigate: ({ id, url }: { readonly id: string; readonly url: string }) =>
				sessions.navigate(id, url),
			goBack: ({ id }: { readonly id: string }) => sessions.goBack(id),
			goForward: ({ id }: { readonly id: string }) => sessions.goForward(id),
			getSessions: () => sessions.getAll(),
			setActive: ({ id }: { readonly id: string }) => sessions.setActive(id),
			updateTitle: ({ id, title }: { readonly id: string; readonly title: string }) =>
				sessions.updateTitle(id, title),
			sessionChanges: () =>
				sessions.changes.pipe(Stream.map((sessions): BrowsingState => ({ sessions }))),
		});
	}),
);

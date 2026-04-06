import { Spec } from "@ctrl/arch.util.spec-builder";
import { Schema } from "effect";

const WebSession = Spec("web-session", { mode: "instance", domain: "session", version: 1 })

	.actions({
		CreateSession: { mode: Schema.String },
		CloseSession: {},
		Navigate: { url: Schema.String },
		ActivateSession: {},
		TitleChanged: { title: Schema.String },
		UrlCommitted: { url: Schema.String, title: Schema.String, favicon: Schema.String },
		NavigationFailed: { error: Schema.String },
	})

	.effects({
		InsertSession: { id: Schema.String },
		RemoveSession: { wasLast: Schema.Boolean },
		ActivateSession: {},
		WriteUrl: {},
		WriteTitle: {},
		WriteFavicon: {},
		RecordHistory: {},
		StartNavigation: {},
		SetError: {},
	})

	.guards({
		UrlIsValid: Schema.Boolean,
	})

	.states("Idle", "Browsing", "Loading", "Error", "Closed")

	.transitions(({ action, effect, guard, state }) => [
		state.Idle.on(action.CreateSession, state.Browsing, [
			effect.InsertSession,
			effect.ActivateSession,
		]),

		state.Browsing.on(action.Navigate, state.Loading, [
			guard.UrlIsValid,
			effect.StartNavigation,
		])
			.on(action.ActivateSession, state.Browsing, [effect.ActivateSession])
			.on(action.TitleChanged, state.Browsing, [effect.WriteTitle])
			.on(action.CloseSession, state.Closed, [effect.RemoveSession]),

		state.Loading.on(action.UrlCommitted, state.Browsing, [
			effect.WriteUrl,
			effect.WriteTitle,
			effect.WriteFavicon,
			effect.RecordHistory,
		]).on(action.NavigationFailed, state.Error, [effect.SetError]),

		state.Error.on(action.Navigate, state.Loading, [effect.StartNavigation]).on(
			action.CloseSession,
			state.Closed,
			[],
		),

		state.Closed,
	])

	.build();

export { WebSession };
export const WebSessionActions = WebSession.actions;
export const WebSessionEffects = WebSession.effectKeys;
export const WebSessionGuards = WebSession.guardKeys;


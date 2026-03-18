import {
	type DatabaseError,
	type Session,
	SessionRepository,
	ValidationError,
	withTracing,
} from "@ctrl/core.shared";
import { Context, Effect, Layer, PubSub, Stream } from "effect";
import { SESSION_FEATURE } from "../lib/constants";
import { canGoBack, canGoForward } from "../lib/session.helpers";

export class SessionFeature extends Context.Tag(SESSION_FEATURE)<
	SessionFeature,
	{
		readonly getAll: () => Effect.Effect<Session[], DatabaseError>;
		readonly create: (mode: "visual") => Effect.Effect<Session, DatabaseError>;
		readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
		readonly navigate: (
			id: string,
			url: string,
		) => Effect.Effect<Session, DatabaseError | ValidationError>;
		readonly goBack: (id: string) => Effect.Effect<Session, DatabaseError | ValidationError>;
		readonly goForward: (id: string) => Effect.Effect<Session, DatabaseError | ValidationError>;
		readonly setActive: (id: string) => Effect.Effect<void, DatabaseError>;
		readonly updateTitle: (
			id: string,
			title: string,
		) => Effect.Effect<Session, DatabaseError | ValidationError>;
		readonly updateUrl: (
			id: string,
			url: string,
		) => Effect.Effect<Session, DatabaseError | ValidationError>;
		readonly changes: Stream.Stream<Session[]>;
	}
>() {}

export const SessionFeatureLive = Layer.effect(
	SessionFeature,
	Effect.gen(function* () {
		const repo = yield* SessionRepository;
		const pubsub = yield* PubSub.unbounded<Session[]>();

		const notify = () =>
			repo.getAll().pipe(Effect.flatMap((sessions) => PubSub.publish(pubsub, sessions)));

		const getSessionOrFail = (id: string) =>
			repo
				.getById(id)
				.pipe(
					Effect.flatMap((session) =>
						session
							? Effect.succeed(session)
							: Effect.fail(new ValidationError({ message: `Session not found: ${id}` })),
					),
				);

		return withTracing(SESSION_FEATURE, {
			getAll: () => repo.getAll(),

			create: (mode: "visual") =>
				repo.create(mode).pipe(Effect.tap(() => notify().pipe(Effect.ignore))),

			remove: (id: string) => repo.remove(id).pipe(Effect.tap(() => notify().pipe(Effect.ignore))),

			navigate: (id: string, url: string) =>
				Effect.gen(function* () {
					const session = yield* getSessionOrFail(id);
					yield* repo.removePagesAfterIndex(id, session.currentIndex);
					yield* repo.addPage(id, url, session.currentIndex + 1);
					yield* repo.updateCurrentIndex(id, session.currentIndex + 1);
					yield* notify().pipe(Effect.ignore);
					return yield* getSessionOrFail(id);
				}),

			goBack: (id: string) =>
				Effect.gen(function* () {
					const session = yield* getSessionOrFail(id);
					if (!canGoBack(session)) {
						return yield* Effect.fail(
							new ValidationError({ message: "Cannot go back: already at first page" }),
						);
					}
					yield* repo.updateCurrentIndex(id, session.currentIndex - 1);
					yield* notify().pipe(Effect.ignore);
					return yield* getSessionOrFail(id);
				}),

			goForward: (id: string) =>
				Effect.gen(function* () {
					const session = yield* getSessionOrFail(id);
					if (!canGoForward(session)) {
						return yield* Effect.fail(
							new ValidationError({ message: "Cannot go forward: already at last page" }),
						);
					}
					yield* repo.updateCurrentIndex(id, session.currentIndex + 1);
					yield* notify().pipe(Effect.ignore);
					return yield* getSessionOrFail(id);
				}),

			setActive: (id: string) =>
				repo.setActive(id).pipe(Effect.tap(() => notify().pipe(Effect.ignore))),

			updateTitle: (id: string, title: string) =>
				Effect.gen(function* () {
					const session = yield* getSessionOrFail(id);
					yield* repo.updatePageTitle(id, session.currentIndex, title);
					yield* notify().pipe(Effect.ignore);
					return yield* getSessionOrFail(id);
				}),

			updateUrl: (id: string, url: string) =>
				Effect.gen(function* () {
					const session = yield* getSessionOrFail(id);
					yield* repo.updatePageUrl(id, session.currentIndex, url);
					yield* notify().pipe(Effect.ignore);
					return yield* getSessionOrFail(id);
				}),

			changes: Stream.fromPubSub(pubsub),
		});
	}),
);

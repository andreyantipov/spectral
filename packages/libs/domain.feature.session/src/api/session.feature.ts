import { type DatabaseError, ValidationError } from "@ctrl/base.error";
import type { Session } from "@ctrl/base.schema";
import { withTracing } from "@ctrl/base.tracing";
import { SessionRepository } from "@ctrl/core.contract.storage";
import { Context, Effect, Layer } from "effect";
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
	}
>() {}

export const SessionFeatureLive = Layer.effect(
	SessionFeature,
	Effect.gen(function* () {
		const repo = yield* SessionRepository;

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

			create: (mode: "visual") => repo.create(mode),

			remove: (id: string) => repo.remove(id),

			navigate: (id: string, url: string) =>
				Effect.gen(function* () {
					const session = yield* getSessionOrFail(id);
					yield* repo.removePagesAfterIndex(id, session.currentIndex);
					yield* repo.addPage(id, url, session.currentIndex + 1);
					yield* repo.updateCurrentIndex(id, session.currentIndex + 1);
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
					return yield* getSessionOrFail(id);
				}),

			setActive: (id: string) => repo.setActive(id),

			updateTitle: (id: string, title: string) =>
				Effect.gen(function* () {
					const session = yield* getSessionOrFail(id);
					yield* repo.updatePageTitle(id, session.currentIndex, title);
					return yield* getSessionOrFail(id);
				}),

			updateUrl: (id: string, url: string) =>
				Effect.gen(function* () {
					const session = yield* getSessionOrFail(id);
					yield* repo.updatePageUrl(id, session.currentIndex, url);
					return yield* getSessionOrFail(id);
				}),
		});
	}),
);

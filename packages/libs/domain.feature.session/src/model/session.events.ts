import type { Session } from "@ctrl/core.base.model";
import type { Stream } from "effect";

export type SessionChanges = Stream.Stream<Session[]>;

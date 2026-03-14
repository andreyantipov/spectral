import type { Session } from "@ctrl/core.shared";
import type { Stream } from "effect";

export type SessionChanges = Stream.Stream<Session[]>;

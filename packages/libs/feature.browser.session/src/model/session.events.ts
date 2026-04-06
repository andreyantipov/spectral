import type { Session } from "@ctrl/base.schema";
import type { Stream } from "effect";

export type SessionChanges = Stream.Stream<Session[]>;

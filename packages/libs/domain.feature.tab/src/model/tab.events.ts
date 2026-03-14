import type { Tab } from "@ctrl/core.shared";
import type { Stream } from "effect";

export type TabChanges = Stream.Stream<Tab[]>;

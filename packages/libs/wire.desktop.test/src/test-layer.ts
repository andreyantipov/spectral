import { FeatureRegistryLive } from "@ctrl/arch.impl.feature-registry";
import { SpecRegistryLive } from "@ctrl/arch.impl.spec-registry";
import { SpecRunnerLive } from "@ctrl/arch.impl.spec-runner";
import { EventBusLive } from "@ctrl/core.impl.event-bus";
import { Layer } from "effect";

/**
 * Test layer without EventBus — for pure FSM testing with mock effects.
 * Provides: SpecRunnerInternal, FeatureRegistry
 */
const RunnerWithRegistryLayer = SpecRunnerLive.pipe(Layer.provide(FeatureRegistryLive));
export const TestSpecEngineLive = Layer.mergeAll(RunnerWithRegistryLayer, FeatureRegistryLive);

/**
 * Test layer with EventBus — for testing SpecRegistry auto-routing.
 * SpecRegistryLive needs SpecRunnerInternal + EventBus.
 */
const InfraLayer = Layer.mergeAll(EventBusLive, FeatureRegistryLive);
const RunnerLayer = SpecRunnerLive.pipe(Layer.provide(InfraLayer));
const RegistryLayer = SpecRegistryLive.pipe(Layer.provide(RunnerLayer), Layer.provide(InfraLayer));

export const TestSpecEngineWithBusLive = Layer.mergeAll(RegistryLayer, InfraLayer);

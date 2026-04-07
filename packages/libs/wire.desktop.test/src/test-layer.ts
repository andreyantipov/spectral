import { EventBusLive } from "@ctrl/arch.impl.event-bus";
import { FeatureRegistryLive } from "@ctrl/arch.impl.feature-registry";
import { SpecRegistryLive } from "@ctrl/arch.impl.spec-registry";
import { SpecRunnerLive } from "@ctrl/arch.impl.spec-runner";
import { Layer } from "effect";

/**
 * Test layer for FSM testing with mock effects.
 * SpecRunner requires EventBus (for emit dispatch + transition events).
 * Provides: SpecRunnerInternal, FeatureRegistry, EventBus
 */
const TestInfraLayer = Layer.mergeAll(EventBusLive, FeatureRegistryLive);
const RunnerWithRegistryLayer = SpecRunnerLive.pipe(Layer.provide(TestInfraLayer));
export const TestSpecEngineLive = Layer.mergeAll(RunnerWithRegistryLayer, TestInfraLayer);

/**
 * Test layer with EventBus — for testing SpecRegistry auto-routing.
 * SpecRegistryLive needs SpecRunnerInternal + EventBus.
 */
const InfraLayer = Layer.mergeAll(EventBusLive, FeatureRegistryLive);
const RunnerLayer = SpecRunnerLive.pipe(Layer.provide(InfraLayer));
const RegistryLayer = SpecRegistryLive.pipe(Layer.provide(RunnerLayer), Layer.provide(InfraLayer));

export const TestSpecEngineWithBusLive = Layer.mergeAll(RegistryLayer, InfraLayer);

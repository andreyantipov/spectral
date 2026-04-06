import { Layer } from "effect"
import { FeatureRegistryLive } from "@ctrl/arch.impl.feature-registry"
import { SpecRunnerLive } from "@ctrl/arch.impl.spec-runner"
import { SpecRegistryLive } from "@ctrl/arch.impl.spec-registry"
import { EventBusLive } from "@ctrl/core.impl.event-bus"

/**
 * Test layer without EventBus — for pure FSM testing with mock effects.
 * Provides: SpecRunnerInternal, FeatureRegistry
 */
export const TestSpecEngineLive = Layer.mergeAll(
  SpecRunnerLive,
  FeatureRegistryLive,
)

/**
 * Test layer with EventBus — for testing SpecRegistry auto-routing.
 * SpecRegistryLive needs SpecRunnerInternal + EventBus.
 */
const InfraLayer = Layer.mergeAll(EventBusLive, FeatureRegistryLive)
const RunnerLayer = SpecRunnerLive.pipe(Layer.provide(InfraLayer))
const RegistryLayer = SpecRegistryLive.pipe(
  Layer.provide(RunnerLayer),
  Layer.provide(InfraLayer),
)

export const TestSpecEngineWithBusLive = Layer.mergeAll(RegistryLayer, InfraLayer)

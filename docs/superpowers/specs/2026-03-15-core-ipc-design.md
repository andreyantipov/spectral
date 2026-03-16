# core.ipc — Typed Inter-Process Command Bus

**Date:** 2026-03-15
**Status:** Draft
**Scope:** Typed bidirectional command channel between Bun and webview processes

---

## 1. Problem

Bun and webview need to exchange app-level commands (toggle command center, show notification, etc.). The current approach uses `executeJavascript` with hardcoded global functions — untyped, fragile, doesn't follow hex architecture.

The existing `@ctrl/domain.adapter.electrobun` layer handles Effect RPC (domain service calls) over Electrobun's IPC. App commands need a separate, typed channel on the same transport.

## 2. Architecture

```
@ctrl/core.shared                 Typed IPC command definitions (pure TS, no deps)
  └── model/commands.ts           AppCommand union (all app-level commands)

core.ui (planned)                 SolidJS integration
  └── useIpcBridge()              Hook to access bridge from components

@ctrl/domain.adapter.electrobun   Concrete IPC bridge implementation
  └── createIpcBridge             Implements IpcBridge over ElectrobunRpcHandle
```

**Dependency flow:** `@ctrl/core.shared` ← `core.ui` (hook only, planned) ← `@ctrl/domain.adapter.electrobun` (implementation)

## 3. Command Types

```typescript
// @ctrl/core.shared/src/model/commands.ts

type ToggleCommandCenter = { readonly type: "toggle-command-center" }

type ShowNotification = {
  readonly type: "notify"
  readonly level: "info" | "success" | "error"
  readonly title: string
  readonly description?: string
}

// Extensible — add new commands here
type AppCommand =
  | ToggleCommandCenter
  | ShowNotification
```

## 4. Bridge Port

```typescript
// @ctrl/domain.adapter.electrobun/src/createIpcBridge.ts (planned extraction to a reusable bridge module)

type IpcBridge = {
  readonly send: (command: AppCommand) => void
  readonly subscribe: (handler: (command: AppCommand) => void) => () => void
}
```

Both sides (Bun + webview) get the same `IpcBridge` interface. Each side:
- Calls `send()` to push commands to the other process
- Calls `subscribe()` to receive commands from the other process

## 5. Transport

Uses a dedicated `"app-commands"` channel on the existing Electrobun RPC handle — same pipe as `"effect-rpc"`, different channel name. Commands are JSON-serialized.

```typescript
// domain.adapter.rpc — Electrobun implementation

const CHANNEL = "app-commands"

function createElectrobunBridge(handle: ElectrobunRpcHandle): IpcBridge {
  const listeners = new Set<(cmd: AppCommand) => void>()

  // Receive commands from the other side
  handle.addMessageListener(CHANNEL, (raw) => {
    const command = raw as AppCommand
    for (const listener of listeners) listener(command)
  })

  return {
    send: (command) => handle.send[CHANNEL](command),
    subscribe: (handler) => {
      listeners.add(handler)
      return () => listeners.delete(handler)
    },
  }
}
```

## 6. Wiring

### Bun side (desktop/src/bun/index.ts)

```typescript
const bridge = createElectrobunBridge(rpcHandle)

// Menu accelerator → command
ApplicationMenu.on("application-menu-clicked", (event) => {
  if (event.data.action === "toggle-command-center") {
    bridge.send({ type: "toggle-command-center" })
  }
})
```

### Webview side (main-ui/index.ts)

```typescript
const bridge = createElectrobunBridge(rpc as ElectrobunRpcHandle)

// Pass bridge into SolidJS context
mount(runtime, bridge)
```

### SolidJS (core.ui hook)

```typescript
// core.ui/src/lib/use-ipc-bridge.ts
const IpcBridgeContext = createContext<IpcBridge>()

function IpcBridgeProvider(props: ParentProps<{ bridge: IpcBridge }>) {
  return <IpcBridgeContext.Provider value={props.bridge}>{props.children}</IpcBridgeContext.Provider>
}

function useIpcBridge(): IpcBridge {
  const bridge = useContext(IpcBridgeContext)
  if (!bridge) throw new Error("IpcBridgeProvider not found")
  return bridge
}
```

### AppShellTemplate consumption

```typescript
function AppShellTemplate(props) {
  const bridge = useIpcBridge()

  onMount(() => {
    const unsub = bridge.subscribe((cmd) => {
      if (cmd.type === "toggle-command-center") toggleCc()
      if (cmd.type === "notify") notify[cmd.level](cmd.title, cmd.description)
    })
    onCleanup(unsub)
  })
}
```

## 7. RPC Schema

Add `"app-commands"` to `MainRPCSchema` on both sides:

```typescript
bun: {
  messages: {
    "effect-rpc": EffectRpcMessage,
    "app-commands": AppCommand,
  }
},
webview: {
  messages: {
    "effect-rpc": EffectRpcMessage,
    "app-commands": AppCommand,
  }
}
```

Both sides can send AND receive app commands.

## 8. Why This Works

- Uses the **same transport** that already works (`addMessageListener` + `send`)
- `"effect-rpc"` channel already proves bidirectional messaging works
- No `executeJavascript`, no window globals, no custom events
- Typed commands — add new ones by extending the union
- Clean separation: `core.ipc` (contract) → `domain.adapter.rpc` (implementation)
- SolidJS integration via context provider, not globals

## 9. Migration

1. Create `core.ipc` package with command types + bridge port
2. Add `createElectrobunBridge` to `domain.adapter.rpc`
3. Add `IpcBridgeProvider` + `useIpcBridge` to `core.ui`
4. Wire in desktop app (bun side + webview side)
5. Remove `executeJavascript`, window globals, custom events from AppShellTemplate
6. Remove `"toggle-command-center"` from `webview.messages` in RPC schema (replaced by `"app-commands"`)

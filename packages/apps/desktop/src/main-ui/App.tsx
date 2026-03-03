import { createSignal, onMount } from "solid-js";
import { TabBar, AddressBar, type TabData } from "@ctrl/core.ui";

type AppProps = {
  rpcPromise: Promise<any>;
};

export default function App(props: AppProps) {
  const [tabs, setTabs] = createSignal<TabData[]>([]);
  const [activeTabId, setActiveTabId] = createSignal<number | null>(null);
  let rpc: any = null;

  const activeUrl = () => {
    const id = activeTabId();
    const tab = tabs().find((t) => t.id === id);
    return tab?.url ?? "";
  };

  onMount(async () => {
    rpc = await props.rpcPromise;
    if (!rpc) return;

    // Listen for tab state pushes from bun
    rpc.addMessageListener(
      "tabsChanged",
      (state: { tabs: TabData[]; activeTabId: number | null }) => {
        setTabs(state.tabs);
        setActiveTabId(state.activeTabId);
      },
    );

    // Load initial tab state
    try {
      const state = await rpc.request.getTabs({});
      setTabs(state.tabs);
      setActiveTabId(state.activeTabId);
    } catch (e) {
      console.error("Failed to load tabs:", e);
    }
  });

  const handleTabClick = (id: number) => {
    rpc?.request.switchTab({ id });
  };

  const handleTabClose = (id: number) => {
    rpc?.request.closeTab({ id });
  };

  const handleNewTab = () => {
    rpc?.request.createTab({ url: "about:blank" });
  };

  const handleNavigate = (url: string) => {
    rpc?.request.navigateTab({ url });
  };

  const handleBack = () => {
    // Content view navigation — not yet implemented
  };

  const handleForward = () => {
    // Content view navigation — not yet implemented
  };

  return (
    <>
      <TabBar
        tabs={tabs()}
        activeTabId={activeTabId()}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onNewTab={handleNewTab}
      />
      <AddressBar
        url={activeUrl()}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
      />
    </>
  );
}

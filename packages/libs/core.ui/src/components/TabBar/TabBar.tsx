import { type JSX, For, Show } from "solid-js";
import { cva, css } from "../../../styled-system/css";

const tabBar = cva({
  base: {
    display: "flex",
    alignItems: "center",
    height: "36px",
    bg: "bg.primary",
    paddingLeft: "80px",
    paddingRight: "8px",
    gap: "2px",
    userSelect: "none",
    overflow: "hidden",
  },
});

const tab = cva({
  base: {
    display: "flex",
    alignItems: "center",
    height: "28px",
    px: "12px",
    gap: "6px",
    borderRadius: "sm",
    fontSize: "12px",
    fontFamily: "body",
    color: "fg.secondary",
    cursor: "pointer",
    flexShrink: 0,
    maxWidth: "180px",
    transition: "all 0.1s ease",
    _hover: {
      bg: "bg.secondary",
      color: "fg.primary",
    },
  },
  variants: {
    active: {
      true: {
        bg: "bg.tertiary",
        color: "fg.primary",
      },
    },
  },
});

const tabTitle = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
});

const closeButton = cva({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    borderRadius: "sm",
    fontSize: "14px",
    lineHeight: 1,
    color: "fg.muted",
    cursor: "pointer",
    flexShrink: 0,
    _hover: {
      bg: "bg.primary",
      color: "fg.primary",
    },
  },
});

const newTabButton = cva({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: "sm",
    fontSize: "18px",
    lineHeight: 1,
    color: "fg.muted",
    cursor: "pointer",
    flexShrink: 0,
    _hover: {
      bg: "bg.secondary",
      color: "fg.primary",
    },
  },
});

export type TabData = {
  id: number;
  url: string;
  title: string;
  isActive: number;
};

type TabBarProps = {
  tabs: TabData[];
  activeTabId: number | null;
  onTabClick: (id: number) => void;
  onTabClose: (id: number) => void;
  onNewTab: () => void;
};

function hostnameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname || url;
  } catch {
    return url || "New Tab";
  }
}

export function TabBar(props: TabBarProps) {
  return (
    <div class={tabBar()}>
      <For each={props.tabs}>
        {(t) => (
          <div
            class={tab({ active: t.id === props.activeTabId })}
            onClick={() => props.onTabClick(t.id)}
          >
            <span class={tabTitle}>
              {t.title !== "New Tab" ? t.title : hostnameFromUrl(t.url)}
            </span>
            <Show when={props.tabs.length > 1}>
              <span
                class={closeButton()}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onTabClose(t.id);
                }}
              >
                &times;
              </span>
            </Show>
          </div>
        )}
      </For>
      <span
        class={newTabButton()}
        onClick={() => props.onNewTab()}
      >
        +
      </span>
    </div>
  );
}

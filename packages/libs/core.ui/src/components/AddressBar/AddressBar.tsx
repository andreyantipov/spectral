import { createSignal, createEffect } from "solid-js";
import { cva, css } from "../../../styled-system/css";

const addressBar = cva({
  base: {
    display: "flex",
    alignItems: "center",
    height: "36px",
    bg: "bg.primary",
    px: "8px",
    gap: "4px",
    userSelect: "none",
  },
});

const navButton = cva({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: "sm",
    fontSize: "16px",
    lineHeight: 1,
    color: "fg.muted",
    cursor: "pointer",
    flexShrink: 0,
    border: "none",
    bg: "transparent",
    _hover: {
      bg: "bg.secondary",
      color: "fg.primary",
    },
  },
});

const urlInput = css({
  flex: 1,
  height: "28px",
  px: "10px",
  bg: "bg.secondary",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "md",
  color: "fg.primary",
  fontSize: "13px",
  fontFamily: "body",
  outline: "none",
  _focus: {
    borderColor: "accent",
  },
  _placeholder: {
    color: "fg.muted",
  },
});

type AddressBarProps = {
  url: string;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
};

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function AddressBar(props: AddressBarProps) {
  const [inputValue, setInputValue] = createSignal(props.url);

  createEffect(() => {
    setInputValue(props.url);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      const normalized = normalizeUrl(inputValue());
      if (normalized) {
        props.onNavigate(normalized);
      }
    }
  };

  const handleFocus = (e: FocusEvent) => {
    (e.target as HTMLInputElement).select();
  };

  return (
    <div class={addressBar()}>
      <button class={navButton()} onClick={() => props.onBack()}>
        &#8592;
      </button>
      <button class={navButton()} onClick={() => props.onForward()}>
        &#8594;
      </button>
      <input
        class={urlInput}
        type="text"
        value={inputValue()}
        onInput={(e) => setInputValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder="Enter URL..."
        spellcheck={false}
      />
    </div>
  );
}

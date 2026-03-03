import { type JSX, splitProps } from "solid-js";
import { css, cva } from "../../../styled-system/css";

const input = cva({
  base: {
    fontFamily: "body",
    fontSize: "14px",
    color: "fg.primary",
    bg: "bg.secondary",
    border: "1px solid",
    borderColor: "border",
    borderRadius: "md",
    outline: "none",
    width: "100%",
    transition: "all 0.15s ease",
    _placeholder: { color: "fg.muted" },
    _focus: { borderColor: "accent" },
    _disabled: { opacity: 0.5, cursor: "not-allowed" },
  },
  variants: {
    size: {
      sm: { height: "32px", px: "10px" },
      md: { height: "38px", px: "12px" },
      lg: { height: "44px", px: "14px" },
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type InputVariants = Parameters<typeof input>[0];

type InputProps = InputVariants &
  JSX.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps) {
  const [variants, rest] = splitProps(props, ["size", "class"]);
  return (
    <input
      class={`${input({ size: variants.size })} ${variants.class ?? ""}`}
      {...rest}
    />
  );
}

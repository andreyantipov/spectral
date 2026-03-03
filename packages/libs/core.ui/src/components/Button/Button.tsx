import { type JSX, splitProps } from "solid-js";
import { css, cva } from "../../../styled-system/css";

const button = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "body",
    fontWeight: "medium",
    cursor: "pointer",
    borderRadius: "md",
    transition: "all 0.15s ease",
    border: "1px solid transparent",
    outline: "none",
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  },
  variants: {
    variant: {
      solid: {
        bg: "accent",
        color: "fg.primary",
        _hover: { bg: "accent.hover" },
        _active: { bg: "accent.active" },
      },
      outline: {
        bg: "transparent",
        color: "fg.primary",
        borderColor: "border",
        _hover: { borderColor: "border.hover", bg: "bg.secondary" },
      },
      ghost: {
        bg: "transparent",
        color: "fg.secondary",
        _hover: { bg: "bg.secondary", color: "fg.primary" },
      },
    },
    size: {
      sm: { height: "32px", px: "12px", fontSize: "13px" },
      md: { height: "38px", px: "16px", fontSize: "14px" },
      lg: { height: "44px", px: "20px", fontSize: "15px" },
    },
  },
  defaultVariants: {
    variant: "solid",
    size: "md",
  },
});

type ButtonVariants = Parameters<typeof button>[0];

type ButtonProps = ButtonVariants &
  JSX.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button(props: ButtonProps) {
  const [variants, rest] = splitProps(props, ["variant", "size", "class"]);
  return (
    <button
      class={`${button({ variant: variants.variant, size: variants.size })} ${variants.class ?? ""}`}
      {...rest}
    />
  );
}

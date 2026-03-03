import { type JSX, type ParentProps, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cva } from "../../../styled-system/css";

const text = cva({
  base: {
    fontFamily: "body",
    color: "fg.primary",
  },
  variants: {
    variant: {
      heading: { fontWeight: "bold", letterSpacing: "-0.02em" },
      body: { fontWeight: "normal" },
      caption: { color: "fg.muted", fontSize: "13px" },
      mono: { fontFamily: "mono", fontSize: "13px" },
    },
    size: {
      xs: { fontSize: "12px" },
      sm: { fontSize: "14px" },
      md: { fontSize: "16px" },
      lg: { fontSize: "20px" },
      xl: { fontSize: "24px" },
      "2xl": { fontSize: "32px" },
    },
  },
  defaultVariants: {
    variant: "body",
    size: "md",
  },
});

type TextVariants = Parameters<typeof text>[0];

type TextProps = ParentProps<
  TextVariants & {
    as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "label";
    class?: string;
  }
>;

export function Text(props: TextProps) {
  const [local, variants] = splitProps(
    props,
    ["as", "children"],
    ["variant", "size", "class"],
  );
  return (
    <Dynamic
      component={local.as ?? "span"}
      class={`${text({ variant: variants.variant, size: variants.size })} ${variants.class ?? ""}`}
    >
      {local.children}
    </Dynamic>
  );
}

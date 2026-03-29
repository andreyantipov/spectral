import { type ParentProps, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { text } from "./text.style";

export type TextProps = ParentProps<{
	variant?: "heading" | "body" | "caption" | "mono";
	size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
	as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "label";
	class?: string;
}>;

export function Text(props: TextProps) {
	const [local, variants] = splitProps(props, ["as", "children", "class"], ["variant", "size"]);
	const $ = text({ variant: variants.variant, size: variants.size });
	return (
		<Dynamic component={local.as ?? "span"} class={`${$.root} ${local.class ?? ""}`}>
			{local.children}
		</Dynamic>
	);
}

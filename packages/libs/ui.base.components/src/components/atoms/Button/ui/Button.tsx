import { type JSX, splitProps } from "solid-js";
import { button } from "./button.style";

export type ButtonProps = {
	variant?: "solid" | "outline" | "ghost";
	size?: "sm" | "md" | "lg";
	class?: string;
} & JSX.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button(props: ButtonProps) {
	const [variants, rest] = splitProps(props, ["variant", "size", "class"]);
	const $ = button({ variant: variants.variant, size: variants.size });
	return <button class={`${$.root} ${variants.class ?? ""}`} {...rest} />;
}

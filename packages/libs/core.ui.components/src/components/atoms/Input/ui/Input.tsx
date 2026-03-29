import { type JSX, splitProps } from "solid-js";
import { input } from "./input.style";

export type InputProps = {
	size?: "sm" | "md" | "lg";
	class?: string;
} & JSX.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps) {
	const [variants, rest] = splitProps(props, ["size", "class"]);
	const $ = input({ size: variants.size });
	return <input class={`${$.root} ${variants.class ?? ""}`} {...rest} />;
}

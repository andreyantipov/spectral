import type { ShortcutBinding } from "@ctrl/base.schema";
import { useApi } from "@ctrl/ui.base.api";
import { type JSX, onCleanup, onMount } from "solid-js";
import { matchShortcut } from "../lib/match-shortcut";

export function KeyboardProvider(props: { children: JSX.Element }) {
	const api = useApi();
	const shortcuts = api.on<ShortcutBinding[]>("settings.shortcuts");

	onMount(() => {
		const handler = (e: KeyboardEvent) => {
			const current = shortcuts();
			if (!current) return;
			const binding = matchShortcut(e, current);
			if (binding) {
				e.preventDefault();
				api.send(binding.action, binding.payload ?? {});
			}
		};
		document.addEventListener("keydown", handler);
		onCleanup(() => document.removeEventListener("keydown", handler));
	});

	return props.children;
}

import { createEffect, createSignal } from "solid-js";
import { addressBar } from "./address-bar.style";

export type AddressBarProps = {
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
	const $ = addressBar();
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
		<div class={$.root}>
			<button type="button" class={$.navButton} onClick={() => props.onBack()}>
				&#8592;
			</button>
			<button type="button" class={$.navButton} onClick={() => props.onForward()}>
				&#8594;
			</button>
			<input
				class={$.urlInput}
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

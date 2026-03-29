import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { omniBox } from "./omni-box.style";

export type OmniBoxSuggestionType = "search" | "url" | "history" | "bookmark" | "tab";

export type OmniBoxSuggestion = {
	type: OmniBoxSuggestionType;
	text: string;
	action?: string;
	url?: string;
};

export type OmniBoxProps = {
	value?: string;
	placeholder?: string;
	engine?: string;
	suggestions?: OmniBoxSuggestion[];
	autocompleteHint?: string;
	onInput?: (value: string) => void;
	onSubmit?: (value: string, suggestion?: OmniBoxSuggestion) => void;
	onCancel?: () => void;
	onDeleteSuggestion?: (suggestion: OmniBoxSuggestion) => void;
};

const SUGGESTION_ICONS: Record<OmniBoxSuggestionType, string> = {
	search: "search",
	url: "globe",
	history: "history",
	bookmark: "bookmark",
	tab: "external-link",
};

function isUrlLike(input: string): boolean {
	const trimmed = input.trim();
	if (/^https?:\/\//i.test(trimmed)) return true;
	if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.([a-zA-Z]{2,})/.test(trimmed)) return true;
	if (trimmed.includes("/") && !trimmed.includes(" ")) return true;
	return false;
}

function normalizeUrl(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) return trimmed;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed)) return `https://${trimmed}`;
	return trimmed;
}

export function OmniBox(props: OmniBoxProps) {
	const $ = omniBox();
	const $h = omniBox({ suggestionHighlighted: true });

	const [query, setQuery] = createSignal(props.value ?? "");
	// -1 = nothing selected (user's typed text shown), 0+ = suggestion highlighted
	const [selectedIndex, setSelectedIndex] = createSignal(-1);
	let inputRef: HTMLInputElement | undefined;

	onMount(() => {
		inputRef?.focus();
		inputRef?.select();
	});

	const suggestions = createMemo(() => props.suggestions ?? []);
	const showDropdown = createMemo(() => query().length > 0 && suggestions().length > 0);

	// What the input field displays: suggestion URL when navigating, typed query otherwise
	const displayedValue = createMemo(() => {
		const idx = selectedIndex();
		if (idx >= 0) {
			const s = suggestions()[idx];
			return s ? (s.url ?? s.text) : query();
		}
		return query();
	});

	const handleInput = (e: InputEvent) => {
		const value = (e.target as HTMLInputElement).value;
		setQuery(value);
		setSelectedIndex(-1);
		props.onInput?.(value);
	};

	const handleSubmit = (suggestion?: OmniBoxSuggestion) => {
		if (suggestion?.url) {
			props.onSubmit?.(suggestion.url, suggestion);
			return;
		}
		const raw = query();
		if (!raw) return;
		const resolved = isUrlLike(raw) ? normalizeUrl(raw) : raw;
		props.onSubmit?.(resolved, suggestion);
	};

	const navigateSuggestions = (dir: 1 | -1) => {
		const count = suggestions().length;
		if (count === 0) return;
		setSelectedIndex((i) => {
			const next = i + dir;
			if (next >= count) return -1; // past last → back to no selection
			if (next < -1) return count - 1; // up from -1 → wrap to last
			return next;
		});
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				navigateSuggestions(1);
				break;
			case "ArrowUp":
				e.preventDefault();
				navigateSuggestions(-1);
				break;
			case "Enter":
				e.preventDefault();
				handleSubmit(selectedIndex() >= 0 ? suggestions()[selectedIndex()] : undefined);
				break;
			case "Escape":
				e.preventDefault();
				props.onCancel?.();
				break;
			case "Delete":
				if (e.shiftKey) {
					e.preventDefault();
					const sel = selectedIndex() >= 0 ? suggestions()[selectedIndex()] : undefined;
					if (sel) props.onDeleteSuggestion?.(sel);
				}
				break;
			case "Tab":
				e.preventDefault();
				handleSubmit(selectedIndex() >= 0 ? suggestions()[selectedIndex()] : undefined);
				break;
		}
	};

	const handleFocus = (e: FocusEvent) => {
		(e.target as HTMLInputElement).select();
	};

	const handleClickOutside = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (!target.closest("[data-omnibox]")) {
			props.onCancel?.();
		}
	};

	createEffect(() => {
		document.addEventListener("mousedown", handleClickOutside);
		onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
	});

	return (
		<div class={$.root} data-omnibox>
			<div class={$.inputRow}>
				<svg
					aria-hidden="true"
					class={$.searchIcon}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="11" cy="11" r="8" />
					<path d="m21 21-4.3-4.3" />
				</svg>
				<Show when={props.engine}>
					<div class={$.engineBadge}>
						<span class={$.engineBadgeText}>{props.engine}</span>
					</div>
				</Show>
				<input
					ref={inputRef}
					class={$.input}
					type="text"
					value={displayedValue()}
					onInput={handleInput}
					onKeyDown={handleKeyDown}
					onFocus={handleFocus}
					placeholder={props.placeholder ?? "Search or enter URL..."}
					spellcheck={false}
					autocomplete="off"
				/>
				<Show when={props.autocompleteHint}>
					<span class={$.autocompleteHint}>{props.autocompleteHint}</span>
				</Show>
			</div>

			<Show when={showDropdown()}>
				<div class={$.divider} />
				<div class={$.dropdown}>
					<For each={suggestions()}>
						{(suggestion, index) => {
							const highlighted = () => index() === selectedIndex();
							const s = () => (highlighted() ? $h : $);
							return (
								<div
									role="option"
									aria-selected={highlighted()}
									tabIndex={0}
									class={s().suggestionRow}
									onMouseEnter={() => setSelectedIndex(index())}
									onClick={() => handleSubmit(suggestion)}
									onKeyDown={(e) => e.key === "Enter" && handleSubmit(suggestion)}
								>
									<SuggestionIcon type={suggestion.type} class={s().suggestionIcon} />
									<span class={s().suggestionText}>{suggestion.text}</span>
									<Show when={suggestion.action}>
										<span class={s().suggestionDash}>&mdash;</span>
										<span class={s().suggestionAction}>{suggestion.action}</span>
									</Show>
								</div>
							);
						}}
					</For>
				</div>
			</Show>
		</div>
	);
}

function SuggestionIcon(props: { type: OmniBoxSuggestionType; class?: string }) {
	const icon = () => SUGGESTION_ICONS[props.type];

	return (
		<svg
			aria-hidden="true"
			class={props.class}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			{iconPath(icon())}
		</svg>
	);
}

function iconPath(name: string) {
	switch (name) {
		case "search":
			return (
				<>
					<circle cx="11" cy="11" r="8" />
					<path d="m21 21-4.3-4.3" />
				</>
			);
		case "globe":
			return (
				<>
					<circle cx="12" cy="12" r="10" />
					<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
					<path d="M2 12h20" />
				</>
			);
		case "history":
			return (
				<>
					<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
					<path d="M3 3v5h5" />
					<path d="M12 7v5l4 2" />
				</>
			);
		case "bookmark":
			return <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />;
		case "external-link":
			return (
				<>
					<path d="M15 3h6v6" />
					<path d="M10 14 21 3" />
					<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
				</>
			);
		default:
			return null;
	}
}

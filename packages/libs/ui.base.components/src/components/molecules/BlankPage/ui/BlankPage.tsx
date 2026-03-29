import { blankPage } from "./blankPage.style";

export function BlankPage() {
	const $ = blankPage;

	return (
		<div class={$().root}>
			<div class={$().icon}>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					role="img"
					aria-label="Globe"
				>
					<title>Globe</title>
					<circle cx="12" cy="12" r="10" />
					<path d="M2 12h20" />
					<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
				</svg>
			</div>
			<span class={$().label}>Spectral</span>
		</div>
	);
}

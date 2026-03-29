import { normalizeProps, useMachine } from "@zag-js/solid";
import * as toast from "@zag-js/toast";
import { For, Show } from "solid-js";
import { notifications } from "./notifications.style";

export type NotificationsProps = {
	placement?: toast.Placement;
};

// Global toast store — allows creating toasts from anywhere in the app
const toastStore = toast.createStore();

/**
 * Show a toast notification from anywhere.
 * Works in overlay mode (z-index: 200, above CommandCenter and webview).
 */
export const notify = {
	success: (title: string, description?: string) =>
		toastStore.create({ type: "success", title, description, duration: 4000, closable: true }),
	error: (title: string, description?: string) =>
		toastStore.create({ type: "error", title, description, duration: 6000, closable: true }),
	info: (title: string, description?: string) =>
		toastStore.create({ type: "info", title, description, duration: 4000, closable: true }),
	loading: (title: string, description?: string) =>
		toastStore.create({ type: "loading", title, description, closable: false }),
};

function Toast(props: { service: toast.Service }) {
	const $ = notifications;
	const api = () => toast.connect(props.service, normalizeProps);

	return (
		<div {...api().getRootProps()} class={$().toast} data-type={api().type}>
			<div style={{ flex: 1 }}>
				<Show when={api().title}>
					<p {...api().getTitleProps()} class={$().toastTitle}>
						{api().title as string}
					</p>
				</Show>
				<Show when={api().description}>
					<p {...api().getDescriptionProps()} class={$().toastDescription}>
						{api().description as string}
					</p>
				</Show>
			</div>
			<Show when={api().closable}>
				<button {...api().getCloseTriggerProps()} class={$().toastCloseTrigger} type="button">
					×
				</button>
			</Show>
		</div>
	);
}

export function Notifications(props: NotificationsProps) {
	const $ = notifications;
	const placement = () => props.placement ?? "bottom-end";

	const service = useMachine(toast.group.machine, {
		id: "notifications",
		store: toastStore,
	});

	const api = () => toast.group.connect(service, normalizeProps);

	return (
		<div {...api().getGroupProps()} class={$().group} data-placement={placement()}>
			<For each={api().getToasts()}>
				{(toastItem) => <Toast service={toastItem as unknown as toast.Service} />}
			</For>
		</div>
	);
}

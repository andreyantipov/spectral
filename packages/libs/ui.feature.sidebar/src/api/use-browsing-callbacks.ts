import { currentUrl } from "@ctrl/core.shared";
import { useBrowsingRpc } from "./use-sidebar";

export function useBrowsingCallbacks() {
	const { client, state } = useBrowsingRpc();

	const activeSession = () => state()?.sessions?.find((s) => s.isActive);
	const activeUrl = () => {
		const session = activeSession();
		return session ? currentUrl(session) : undefined;
	};

	return {
		activeSessionId: () => activeSession()?.id ?? "",
		activeUrl,
		onNavigate: (url: string) => {
			const session = activeSession();
			if (session) {
				void client.reportNavigation({ id: session.id, url });
			}
		},
		onTitleChange: (title: string) => {
			const session = activeSession();
			if (session) {
				void client.updateTitle({ id: session.id, title });
			}
		},
	};
}

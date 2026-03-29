import { DEFAULT_TAB_URL } from "./constants";

export type Page = {
	readonly url: string;
	readonly title: string | null;
	readonly loadedAt: string;
};
export type SessionLike = {
	readonly pages: readonly Page[];
	readonly currentIndex: number;
};

export const currentPage = (session: SessionLike): Page | undefined =>
	session.pages[session.currentIndex];

export const canGoBack = (session: SessionLike): boolean => session.currentIndex > 0;

export const canGoForward = (session: SessionLike): boolean =>
	session.currentIndex < session.pages.length - 1;

export const currentUrl = (session: SessionLike): string =>
	currentPage(session)?.url ?? DEFAULT_TAB_URL;

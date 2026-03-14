import type { Page, Session } from "@ctrl/core.shared";
import { DEFAULT_TAB_URL } from "@ctrl/core.shared";

export const currentPage = (session: Session): Page | undefined =>
	session.pages[session.currentIndex];

export const canGoBack = (session: Session): boolean => session.currentIndex > 0;

export const canGoForward = (session: Session): boolean =>
	session.currentIndex < session.pages.length - 1;

export const currentUrl = (session: Session): string =>
	currentPage(session)?.url ?? DEFAULT_TAB_URL;

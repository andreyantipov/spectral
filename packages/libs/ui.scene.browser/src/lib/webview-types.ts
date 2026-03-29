export type WebviewTagElement = HTMLElement & {
	loadURL: (url: string) => void;
	reload: () => void;
	goBack: () => void;
	goForward: () => void;
	canGoBack: () => boolean;
	canGoForward: () => boolean;
	toggleHidden: (hidden?: boolean) => void;
	toggleTransparent: (transparent?: boolean) => void;
	togglePassthrough: (passthrough?: boolean) => void;
	syncDimensions: (force?: boolean) => void;
	addMaskSelector: (selector: string) => void;
	removeMaskSelector: (selector: string) => void;
	executeJavascript: (js: string) => Promise<unknown>;
	on: (event: string, handler: (event: CustomEvent) => void) => void;
	off: (event: string, handler: (event: CustomEvent) => void) => void;
};

export type WebviewHookProps = {
	readonly sessionId: string;
	readonly url: string;
	readonly onNavigate: (url: string) => void;
	readonly onTitleChange: (title: string) => void;
	readonly onDomReady: () => void;
	readonly maskSelectors?: readonly string[];
};

export type WebviewHookResult = {
	readonly containerRef: (el: HTMLDivElement) => void;
	readonly navigate: (url: string) => void;
};

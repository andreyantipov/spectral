/** Props for the managed Electrobun webview component */
export type ManagedWebviewProps = {
	/** URL to load. Changes trigger navigation without recreating the webview */
	url: string;
	/** Whether this webview is the active/visible one in its group */
	isActive: boolean;
	/** Unique session identifier */
	sessionId: string;
	/** CSS selectors for DOM elements that should overlay the native view */
	overlayMasks?: readonly string[];
	/** Preload script to inject */
	preload?: string;
	/** Called when webview navigates to a new URL */
	onNavigate?: (url: string) => void;
	/** Called when page title changes */
	onTitleChange?: (title: string) => void;
};

/** Electrobun webview element interface (runtime API) */
export type WebviewElement = HTMLElement & {
	toggleTransparent: (transparent: boolean) => void;
	togglePassthrough: (passthrough: boolean) => void;
	syncDimensions: (force?: boolean) => void;
	addMaskSelector: (selector: string) => void;
	removeMaskSelector: (selector: string) => void;
	loadURL: (url: string) => void;
	executeJavascript: (code: string) => Promise<unknown>;
	on: (event: string, handler: (e: CustomEvent) => void) => void;
	webviewId?: number;
	transparent?: boolean;
};

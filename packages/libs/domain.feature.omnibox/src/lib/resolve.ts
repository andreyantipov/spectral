import type { OmniboxResult, SearchEngine } from "../model/omnibox.model";

// Matches any explicit scheme (http://, ftp://, file://, etc.)
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

function isUrlLike(input: string): boolean {
	if (SCHEME_RE.test(input)) return true;
	if (/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(input)) return true;
	if (/^localhost(:\d+)?$/.test(input)) return true;
	return false;
}

function normalizeUrl(input: string): string {
	if (SCHEME_RE.test(input)) return input;
	if (/^localhost(:\d+)?$/.test(input)) return `http://${input}`;
	return `https://${input}`;
}

export function resolveInput(raw: string, engine: SearchEngine): OmniboxResult {
	const input = raw.trim();
	if (isUrlLike(input)) {
		return { url: normalizeUrl(input), query: null };
	}
	return {
		url: engine.buildUrl(input),
		query: input,
	};
}

import { describe, expect, it } from "vitest";
import { resolveInput } from "./resolve";

const Google = {
	name: "Google",
	buildUrl: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
};

describe("resolveInput — URLs", () => {
	it("passes through https:// URLs unchanged", () => {
		const r = resolveInput("https://example.com", Google);
		expect(r.url).toBe("https://example.com");
		expect(r.query).toBeNull();
	});

	it("prepends https:// to bare domains", () => {
		const r = resolveInput("example.com", Google);
		expect(r.url).toBe("https://example.com");
		expect(r.query).toBeNull();
	});

	it("prepends https:// to domains with paths", () => {
		const r = resolveInput("github.com/user/repo", Google);
		expect(r.url).toBe("https://github.com/user/repo");
		expect(r.query).toBeNull();
	});

	it("prepends http:// to localhost", () => {
		const r = resolveInput("localhost", Google);
		expect(r.url).toBe("http://localhost");
		expect(r.query).toBeNull();
	});

	it("prepends http:// to localhost with port", () => {
		const r = resolveInput("localhost:3000", Google);
		expect(r.url).toBe("http://localhost:3000");
		expect(r.query).toBeNull();
	});

	it("trims whitespace before classifying", () => {
		const r = resolveInput("  google.com  ", Google);
		expect(r.url).toBe("https://google.com");
		expect(r.query).toBeNull();
	});

	it("passes through non-http URLs with explicit schemes unchanged", () => {
		const r = resolveInput("ftp://files.example.com", Google);
		expect(r.url).toBe("ftp://files.example.com");
		expect(r.query).toBeNull();
	});
});

describe("resolveInput — search queries", () => {
	it("builds Google search URL for plain text", () => {
		const r = resolveInput("solid js tutorials", Google);
		expect(r.url).toBe("https://www.google.com/search?q=solid%20js%20tutorials");
		expect(r.query).toBe("solid js tutorials");
	});

	it("builds Google search URL for natural language queries", () => {
		const r = resolveInput("what is effect-ts", Google);
		expect(r.url).toBe("https://www.google.com/search?q=what%20is%20effect-ts");
		expect(r.query).toBe("what is effect-ts");
	});

	it("returns trimmed query as the query field", () => {
		const r = resolveInput("  hello world  ", Google);
		expect(r.query).toBe("hello world");
	});
});

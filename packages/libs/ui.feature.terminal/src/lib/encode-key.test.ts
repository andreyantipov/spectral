import { describe, expect, it } from "vitest";
import { encodeKey } from "./encode-key";

const key = (key: string, opts: Partial<KeyboardEvent> = {}) =>
	({
		key,
		ctrlKey: false,
		altKey: false,
		shiftKey: false,
		metaKey: false,
		...opts,
	}) as KeyboardEvent;

describe("encodeKey", () => {
	it("encodes printable characters", () => {
		expect(encodeKey(key("a"))).toBe("a");
		expect(encodeKey(key("Z"))).toBe("Z");
		expect(encodeKey(key("1"))).toBe("1");
	});

	it("encodes Enter as carriage return", () => {
		expect(encodeKey(key("Enter"))).toBe("\r");
	});

	it("encodes Backspace as DEL", () => {
		expect(encodeKey(key("Backspace"))).toBe("\x7f");
	});

	it("encodes Tab", () => {
		expect(encodeKey(key("Tab"))).toBe("\t");
	});

	it("encodes Escape", () => {
		expect(encodeKey(key("Escape"))).toBe("\x1b");
	});

	it("encodes arrow keys", () => {
		expect(encodeKey(key("ArrowUp"))).toBe("\x1b[A");
		expect(encodeKey(key("ArrowDown"))).toBe("\x1b[B");
		expect(encodeKey(key("ArrowRight"))).toBe("\x1b[C");
		expect(encodeKey(key("ArrowLeft"))).toBe("\x1b[D");
	});

	it("encodes Ctrl+C as ETX", () => {
		expect(encodeKey(key("c", { ctrlKey: true }))).toBe("\x03");
	});

	it("encodes Ctrl+D as EOT", () => {
		expect(encodeKey(key("d", { ctrlKey: true }))).toBe("\x04");
	});

	it("encodes Ctrl+Z as SUB", () => {
		expect(encodeKey(key("z", { ctrlKey: true }))).toBe("\x1a");
	});

	it("encodes Ctrl+L as FF", () => {
		expect(encodeKey(key("l", { ctrlKey: true }))).toBe("\x0c");
	});

	it("returns null for modifier-only keys", () => {
		expect(encodeKey(key("Control"))).toBeNull();
		expect(encodeKey(key("Shift"))).toBeNull();
		expect(encodeKey(key("Alt"))).toBeNull();
		expect(encodeKey(key("Meta"))).toBeNull();
	});

	it("encodes Home/End", () => {
		expect(encodeKey(key("Home"))).toBe("\x1b[H");
		expect(encodeKey(key("End"))).toBe("\x1b[F");
	});

	it("encodes Delete", () => {
		expect(encodeKey(key("Delete"))).toBe("\x1b[3~");
	});

	it("encodes F1-F4", () => {
		expect(encodeKey(key("F1"))).toBe("\x1bOP");
		expect(encodeKey(key("F2"))).toBe("\x1bOQ");
		expect(encodeKey(key("F3"))).toBe("\x1bOR");
		expect(encodeKey(key("F4"))).toBe("\x1bOS");
	});

	it("encodes Alt+key with ESC prefix", () => {
		expect(encodeKey(key("a", { altKey: true }))).toBe("\x1ba");
	});
});

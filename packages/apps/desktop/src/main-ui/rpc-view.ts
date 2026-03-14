type ElectroviewModule = typeof import("electrobun/view");
type ElectroviewClass = ElectroviewModule["Electroview"];

export function defineRPC(ev: ElectroviewClass) {
	return ev.defineRPC({
		handlers: {
			requests: {},
			messages: {},
		},
	});
}

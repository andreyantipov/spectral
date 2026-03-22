import type { GroupPanelPartInitParameters, IContentRenderer } from "dockview-core";
import type { Component } from "solid-js";
import { render } from "solid-js/web";

export type PanelProps = {
	params: Record<string, unknown>;
	api: GroupPanelPartInitParameters["api"];
};

export const createSolidRenderer = (
	component: Component<PanelProps>,
): { new (): IContentRenderer } => {
	return class SolidRenderer implements IContentRenderer {
		private _element: HTMLElement;
		private _dispose?: () => void;

		get element(): HTMLElement {
			return this._element;
		}

		constructor() {
			this._element = document.createElement("div");
			this._element.style.height = "100%";
			this._element.style.width = "100%";
		}

		init(parameters: GroupPanelPartInitParameters): void {
			this._dispose = render(
				() => component({ params: parameters.params, api: parameters.api }),
				this._element,
			);
		}

		dispose(): void {
			this._dispose?.();
		}
	};
};

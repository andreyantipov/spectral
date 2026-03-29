import type { Preview } from "storybook-solidjs";
import "../../core.ui.design/build/styles.css";

const preview: Preview = {
	parameters: {
		backgrounds: {
			default: "dark",
			values: [
				{ name: "dark", value: "#0a0a0a" },
				{ name: "light", value: "#fafafa" },
			],
		},
	},
};

export default preview;

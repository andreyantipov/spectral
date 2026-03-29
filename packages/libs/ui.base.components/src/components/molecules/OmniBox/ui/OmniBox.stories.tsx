import type { Meta, StoryObj } from "storybook-solidjs";
import { OmniBox } from "./OmniBox";

const meta = {
	title: "Molecules/OmniBox",
	component: OmniBox,
	args: {
		onInput: () => {},
		onSubmit: () => {},
		onCancel: () => {},
		onDeleteSuggestion: () => {},
	},
} satisfies Meta<typeof OmniBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
	args: {
		placeholder: "Search or enter URL...",
		engine: "Google",
	},
};

export const SearchWithSuggestions: Story = {
	args: {
		value: "ddddaxasd",
		engine: "Google",
		autocompleteHint: "it",
		suggestions: [
			{
				type: "search",
				text: "ddddaxasd",
				action: "Search with Google",
			},
			{
				type: "history",
				text: "ddddaxasd reddit thread",
			},
			{
				type: "tab",
				text: "ddddaxasd results",
				action: "Switch to tab",
			},
		],
	},
};

export const UrlWithSuggestions: Story = {
	args: {
		value: "https://github.com/Effect-TS/effect",
		suggestions: [
			{
				type: "url",
				text: "github.com/Effect-TS/effect",
				action: "Go to URL",
				url: "https://github.com/Effect-TS/effect",
			},
			{
				type: "bookmark",
				text: "Effect Documentation",
				url: "https://effect.website/docs",
			},
			{
				type: "history",
				text: "github.com/Effect-TS",
				url: "https://github.com/Effect-TS",
			},
		],
	},
};

export const NoEngine: Story = {
	args: {
		value: "hello world",
		suggestions: [
			{
				type: "search",
				text: "hello world",
				action: "Search the Web",
			},
		],
	},
};

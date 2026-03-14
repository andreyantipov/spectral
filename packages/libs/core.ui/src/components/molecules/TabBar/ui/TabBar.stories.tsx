import type { Meta, StoryObj } from "storybook-solidjs";
import { TabBar } from "./TabBar";

const sampleTabs = [
	{ id: 1, url: "https://example.com", title: "Example", isActive: 1 },
	{ id: 2, url: "https://solidjs.com", title: "SolidJS", isActive: 0 },
	{ id: 3, url: "about:blank", title: "New Tab", isActive: 0 },
];

const meta = {
	title: "Molecules/TabBar",
	component: TabBar,
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		tabs: sampleTabs,
		activeTabId: 1,
	},
};

export const SingleTab: Story = {
	args: {
		tabs: [sampleTabs[0]],
		activeTabId: 1,
	},
};

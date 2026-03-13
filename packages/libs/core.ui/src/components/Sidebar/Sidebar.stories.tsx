import type { Meta, StoryObj } from "storybook-solidjs";
import { Sidebar } from "./Sidebar";

const tabIcons = {
	tabs: () => <span>&#9776;</span>,
	bookmarks: () => <span>&#9734;</span>,
	history: () => <span>&#8634;</span>,
	downloads: () => <span>&#8681;</span>,
};

const defaultTabs = [
	{ id: "tabs", icon: tabIcons.tabs(), label: "Tabs" },
	{ id: "bookmarks", icon: tabIcons.bookmarks(), label: "Bookmarks", badge: 3 },
	{ id: "history", icon: tabIcons.history(), label: "History" },
	{ id: "downloads", icon: tabIcons.downloads(), label: "Downloads" },
];

const defaultItems = [
	{ id: "welcome", icon: <span>&#127760;</span>, label: "Welcome!" },
	{ id: "newtab", icon: <span>+</span>, label: "New Tab" },
	{ id: "privacy", icon: <span>&#128274;</span>, label: "zen-browser.app/privacy-policy/" },
];

const meta: Meta<typeof Sidebar> = {
	title: "Components/Sidebar",
	component: Sidebar,
	argTypes: {
		position: { control: "select", options: ["left", "right"] },
		float: { control: "boolean" },
		collapsed: { control: "boolean" },
		defaultWidth: { control: { type: "range", min: 180, max: 400 } },
	},
	decorators: [
		(Story) => (
			<div
				style={{ height: "500px", display: "flex", position: "relative", background: "#1a1a1a" }}
			>
				<Story />
				<div
					style={{
						flex: 1,
						display: "flex",
						"align-items": "center",
						"justify-content": "center",
						color: "#666",
					}}
				>
					Page Content
				</div>
			</div>
		),
	],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		tabs: defaultTabs,
		activeTabId: "tabs",
		items: defaultItems,
		activeItemId: "welcome",
		position: "left",
		defaultWidth: 240,
	},
};

export const Collapsed: Story = {
	args: {
		tabs: defaultTabs,
		activeTabId: "tabs",
		items: defaultItems,
		collapsed: true,
		position: "left",
	},
};

export const FloatMode: Story = {
	args: {
		tabs: defaultTabs,
		activeTabId: "bookmarks",
		items: defaultItems,
		float: true,
		position: "left",
		defaultWidth: 260,
	},
};

export const RightPosition: Story = {
	args: {
		tabs: defaultTabs,
		activeTabId: "history",
		items: defaultItems,
		position: "right",
		defaultWidth: 240,
	},
};

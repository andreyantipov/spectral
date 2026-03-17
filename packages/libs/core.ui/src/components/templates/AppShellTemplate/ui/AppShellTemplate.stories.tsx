import type { Meta, StoryObj } from "storybook-solidjs";
import { AppShellTemplate } from "./AppShellTemplate";

const tabIcons = {
	sessions: () => <span>&#9776;</span>,
	bookmarks: () => <span>&#9734;</span>,
	history: () => <span>&#8634;</span>,
};

const defaultTabs = [
	{ id: "sessions", icon: tabIcons.sessions(), label: "Sessions" },
	{ id: "bookmarks", icon: tabIcons.bookmarks(), label: "Bookmarks" },
	{ id: "history", icon: tabIcons.history(), label: "History" },
];

const sessionItems = [
	{
		id: "yt",
		icon: <span style={{ color: "#f00" }}>&#9679;</span>,
		label: "YouTube — youtube.com",
	},
	{ id: "welcome", icon: <span style={{ color: "#f80" }}>&#9679;</span>, label: "Welcome!" },
	{
		id: "wiki",
		icon: <span style={{ color: "#888" }}>&#9679;</span>,
		label: "Wikipedia — wikipedia.org",
	},
];

const omniboxSuggestions = [
	{ type: "tab" as const, text: "YouTube", url: "https://youtube.com", action: "Switch" },
	{ type: "tab" as const, text: "Welcome!", url: "about:blank", action: "Switch" },
	{ type: "bookmark" as const, text: "GitHub", url: "https://github.com" },
	{ type: "bookmark" as const, text: "Stack Overflow", url: "https://stackoverflow.com" },
];

const meta: Meta<typeof AppShellTemplate> = {
	title: "Templates/AppShellTemplate",
	component: AppShellTemplate,
	decorators: [
		(Story) => (
			<div style={{ height: "600px", width: "100%", display: "flex" }}>
				<Story />
			</div>
		),
	],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		sidebar: {
			tabs: defaultTabs,
			activeTabId: "sessions",
			items: sessionItems,
			activeItemId: "yt",
		},
		omniBox: {
			suggestions: omniboxSuggestions,
		},
		children: <span style={{ color: "#555", "font-family": "monospace" }}>Page Content</span>,
	},
};

export const WithOmniBoxOpen: Story = {
	render: () => (
		<div style={{ height: "600px", width: "100%", display: "flex", position: "relative" }}>
			<AppShellTemplate
				sidebar={{
					tabs: defaultTabs,
					activeTabId: "sessions",
					items: sessionItems,
					activeItemId: "yt",
				}}
				omniBox={{
					suggestions: omniboxSuggestions,
				}}
			>
				<span style={{ color: "#555", "font-family": "monospace" }}>
					Page Content (press Cmd+K or Cmd+L to open omnibox)
				</span>
			</AppShellTemplate>
		</div>
	),
};

export const CollapsedSidebar: Story = {
	args: {
		sidebar: {
			tabs: defaultTabs,
			activeTabId: "sessions",
			items: sessionItems,
			collapsed: true,
		},
		omniBox: {
			suggestions: omniboxSuggestions,
		},
		children: <span style={{ color: "#555", "font-family": "monospace" }}>Page Content</span>,
	},
};

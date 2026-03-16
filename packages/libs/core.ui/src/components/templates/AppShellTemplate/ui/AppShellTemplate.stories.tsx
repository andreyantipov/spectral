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

const commandCenterItems = [
	{
		id: "yt",
		icon: <span style={{ color: "#f00", "font-size": "12px" }}>&#9679;</span>,
		label: "YouTube",
		secondaryLabel: "— youtube.com",
		section: "// open_tabs",
		badge: "Switch to Tab",
	},
	{
		id: "welcome",
		icon: <span style={{ color: "#f80", "font-size": "12px" }}>&#9679;</span>,
		label: "Welcome!",
		section: "// open_tabs",
	},
	{
		id: "gh",
		icon: <span>&#9734;</span>,
		label: "GitHub",
		secondaryLabel: "— github.com",
		section: "// bookmarks",
	},
	{
		id: "so",
		icon: <span>&#9734;</span>,
		label: "Stack Overflow",
		secondaryLabel: "— stackoverflow.com",
		section: "// bookmarks",
	},
	{
		id: "new-tab",
		icon: <span>+</span>,
		label: "New Tab",
		section: "// commands",
	},
	{
		id: "bookmark",
		icon: <span>&#9734;</span>,
		label: "Bookmark Current Page",
		section: "// commands",
	},
	{
		id: "clear-history",
		icon: <span>&#128465;</span>,
		label: "Clear Browsing History",
		section: "// commands",
	},
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
		commandCenter: {
			items: commandCenterItems,
		},
		children: <span style={{ color: "#555", "font-family": "monospace" }}>Page Content</span>,
	},
};

export const WithCommandCenterOpen: Story = {
	render: () => (
		<div style={{ height: "600px", width: "100%", display: "flex", position: "relative" }}>
			<AppShellTemplate
				sidebar={{
					tabs: defaultTabs,
					activeTabId: "sessions",
					items: sessionItems,
					activeItemId: "yt",
				}}
				commandCenter={{
					items: commandCenterItems,
					onSelect: (_id) => {},
				}}
			>
				<span style={{ color: "#555", "font-family": "monospace" }}>
					Page Content (press Cmd+K to open command center)
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
		commandCenter: {
			items: commandCenterItems,
		},
		children: <span style={{ color: "#555", "font-family": "monospace" }}>Page Content</span>,
	},
};

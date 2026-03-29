import type { Meta, StoryObj } from "storybook-solidjs";
import { Sidebar } from "./Sidebar";

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

const bookmarkItems = [
	{ id: "gh", icon: <span>&#9734;</span>, label: "GitHub", secondaryLabel: "github.com" },
	{
		id: "so",
		icon: <span>&#9734;</span>,
		label: "Stack Overflow",
		secondaryLabel: "stackoverflow.com",
	},
	{
		id: "mdn",
		icon: <span>&#9734;</span>,
		label: "MDN Web Docs",
		secondaryLabel: "developer.mozilla.org",
	},
	{
		id: "hn",
		icon: <span>&#9734;</span>,
		label: "Hacker News",
		secondaryLabel: "news.ycombinator.com",
	},
];

const historyItems = [
	{ id: "h1", label: "Reddit — reddit.com", secondaryLabel: "2:34 PM" },
	{ id: "h2", label: "BBC — bbc.co.uk", secondaryLabel: "1:15 PM" },
	{ id: "h3", label: "YouTube — youtube.com", secondaryLabel: "12:02 PM" },
	{ id: "h4", label: "Wikipedia — wikipedia.org", secondaryLabel: "Yesterday" },
];

const meta: Meta<typeof Sidebar> = {
	title: "Organisms/Sidebar",
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

export const SessionsView: Story = {
	args: {
		tabs: defaultTabs,
		activeTabId: "sessions",
		items: sessionItems,
		activeItemId: "yt",
		position: "left",
		defaultWidth: 240,
	},
};

export const BookmarksView: Story = {
	args: {
		tabs: defaultTabs,
		activeTabId: "bookmarks",
		items: bookmarkItems,
		position: "left",
		defaultWidth: 240,
	},
};

export const HistoryView: Story = {
	args: {
		tabs: defaultTabs,
		activeTabId: "history",
		items: historyItems,
		position: "left",
		defaultWidth: 260,
		panelActions: (
			<button
				type="button"
				style={{
					background: "none",
					border: "none",
					color: "#888",
					cursor: "pointer",
					"font-size": "11px",
					"font-family": "inherit",
				}}
			>
				Clear
			</button>
		),
	},
};

export const Collapsed: Story = {
	args: {
		tabs: defaultTabs,
		activeTabId: "sessions",
		items: sessionItems,
		collapsed: true,
		position: "left",
	},
};

export const FloatMode: Story = {
	args: {
		tabs: defaultTabs,
		activeTabId: "sessions",
		items: sessionItems,
		activeItemId: "yt",
		float: true,
		position: "left",
		defaultWidth: 260,
	},
};

export const RightPosition: Story = {
	args: {
		tabs: defaultTabs,
		activeTabId: "bookmarks",
		items: bookmarkItems,
		position: "right",
		defaultWidth: 240,
	},
};

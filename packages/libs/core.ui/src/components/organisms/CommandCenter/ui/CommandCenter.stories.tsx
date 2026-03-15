import type { Meta, StoryObj } from "storybook-solidjs";
import { CommandCenter } from "./CommandCenter";

const defaultItems = [
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
		id: "wiki",
		label: "Wikipedia",
		secondaryLabel: "— wikipedia.org",
		section: "// bookmarks",
	},
	{
		id: "bbc",
		label: "BBC",
		secondaryLabel: "— bbc.co.uk",
		section: "// bookmarks",
	},
	{
		id: "reddit",
		label: "Reddit",
		secondaryLabel: "— reddit.com",
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

const meta: Meta<typeof CommandCenter> = {
	title: "Organisms/CommandCenter",
	component: CommandCenter,
	decorators: [
		(Story) => (
			<div
				style={{
					height: "600px",
					display: "flex",
					position: "relative",
					background: "#141414",
					"align-items": "center",
					"justify-content": "center",
					color: "#555",
				}}
			>
				Page Content
				<Story />
			</div>
		),
	],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		open: true,
		items: defaultItems,
	},
};

export const WithSearch: Story = {
	args: {
		open: true,
		items: defaultItems,
		placeholder: "Type to filter tabs, bookmarks, and commands...",
	},
};

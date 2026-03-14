import type { Meta, StoryObj } from "storybook-solidjs";
import { AddressBar } from "./AddressBar";

const meta = {
	title: "Molecules/AddressBar",
	component: AddressBar,
} satisfies Meta<typeof AddressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		url: "https://example.com",
	},
};

export const Empty: Story = {
	args: {
		url: "",
	},
};

import type { Meta, StoryObj } from "storybook-solidjs";
import { Text } from "./Text";

const meta = {
	title: "Components/Text",
	component: Text,
	argTypes: {
		variant: {
			control: "select",
			options: ["heading", "body", "caption", "mono"],
		},
		size: {
			control: "select",
			options: ["xs", "sm", "md", "lg", "xl", "2xl"],
		},
		as: {
			control: "select",
			options: ["span", "p", "h1", "h2", "h3", "h4", "label"],
		},
	},
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Body: Story = {
	args: { variant: "body", children: "Body text" },
};

export const Heading: Story = {
	args: { variant: "heading", size: "xl", as: "h1", children: "Heading" },
};

export const Caption: Story = {
	args: { variant: "caption", children: "Caption text" },
};

export const Mono: Story = {
	args: { variant: "mono", children: "monospace text" },
};

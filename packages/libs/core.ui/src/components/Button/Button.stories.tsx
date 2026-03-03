import type { Meta, StoryObj } from "storybook-solidjs";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: ["solid", "outline", "ghost"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Solid: Story = {
  args: { variant: "solid", size: "md", children: "Button" },
};

export const Outline: Story = {
  args: { variant: "outline", size: "md", children: "Button" },
};

export const Ghost: Story = {
  args: { variant: "ghost", size: "md", children: "Button" },
};

export const Small: Story = {
  args: { variant: "solid", size: "sm", children: "Small" },
};

export const Large: Story = {
  args: { variant: "solid", size: "lg", children: "Large" },
};

export const Disabled: Story = {
  args: { variant: "solid", children: "Disabled", disabled: true },
};

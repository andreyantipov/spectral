import type { Meta, StoryObj } from "storybook-solidjs";
import { Input } from "./Input";

const meta = {
  title: "Components/Input",
  component: Input,
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Enter text..." },
};

export const Small: Story = {
  args: { size: "sm", placeholder: "Small input" },
};

export const Large: Story = {
  args: { size: "lg", placeholder: "Large input" },
};

export const Disabled: Story = {
  args: { placeholder: "Disabled", disabled: true },
};

import type { Meta, StoryObj } from "storybook-solidjs";
import { Notifications, notify } from "./Notifications";

const meta: Meta<typeof Notifications> = {
	title: "Organisms/Notifications",
	component: Notifications,
	decorators: [
		(Story) => (
			<div style={{ height: "400px", width: "100%", position: "relative" }}>
				<Story />
				<div style={{ display: "flex", gap: "8px", padding: "16px" }}>
					<button type="button" onClick={() => notify.success("Success", "Operation completed")}>
						Success
					</button>
					<button type="button" onClick={() => notify.error("Error", "Something went wrong")}>
						Error
					</button>
					<button type="button" onClick={() => notify.info("Info", "Here is some info")}>
						Info
					</button>
					<button
						type="button"
						onClick={() => notify.info("IPC Test", "If you see this, the bus works")}
					>
						Simulate IPC
					</button>
				</div>
			</div>
		),
	],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		placement: "bottom-end",
	},
};

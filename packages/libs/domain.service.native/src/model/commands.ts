export type ToggleCommandCenter = {
	readonly type: "toggle-command-center";
};

export type ShowNotification = {
	readonly type: "notify";
	readonly level: "info" | "success" | "error";
	readonly title: string;
	readonly description?: string;
};

export type AppCommand = ToggleCommandCenter | ShowNotification;

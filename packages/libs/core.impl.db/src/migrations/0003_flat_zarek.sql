CREATE TABLE `workspace_layout` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`dockviewState` text DEFAULT '{}' NOT NULL,
	`updatedAt` text NOT NULL
);

CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`pageIndex` integer NOT NULL,
	`loadedAt` text NOT NULL,
	FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'visual' NOT NULL,
	`isActive` integer DEFAULT false NOT NULL,
	`currentIndex` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);

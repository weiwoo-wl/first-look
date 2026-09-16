CREATE TABLE `creation_likes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creation_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`creation_id`) REFERENCES `creations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `creation_shares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creation_id` integer NOT NULL,
	`source` text DEFAULT 'copy-link' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`creation_id`) REFERENCES `creations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `creations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT '早期测试' NOT NULL,
	`story` text DEFAULT '' NOT NULL,
	`creator_id` text NOT NULL,
	`creator_name` text NOT NULL,
	`media_key` text,
	`media_type` text,
	`visibility` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creations_slug_idx` ON `creations` (`slug`);
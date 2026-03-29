CREATE TABLE `saved_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`icon` varchar(50),
	`filters` text,
	`columns` text,
	`sort_by` varchar(100),
	`sort_dir` enum('asc','desc') DEFAULT 'desc',
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `custom_field_defs` ADD `visibility_rules` text;
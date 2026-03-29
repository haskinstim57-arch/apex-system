CREATE TABLE `funnels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(500) NOT NULL,
	`description` text,
	`steps` json,
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `landing_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`slug` varchar(200) NOT NULL,
	`title` varchar(500) NOT NULL,
	`meta_description` text,
	`html_content` text,
	`css_content` text,
	`gjs_data` json,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`favicon_url` varchar(1000),
	`header_code` text,
	`footer_code` text,
	`view_count` int NOT NULL DEFAULT 0,
	`submission_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `landing_pages_id` PRIMARY KEY(`id`)
);

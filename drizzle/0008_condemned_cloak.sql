CREATE TABLE `deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`pipeline_id` int NOT NULL,
	`stage_id` int NOT NULL,
	`contact_id` int NOT NULL,
	`title` varchar(500),
	`value` int DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pipeline_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pipeline_id` int NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`color` varchar(20) NOT NULL DEFAULT '#6b7280',
	`sort_order` int NOT NULL DEFAULT 0,
	`is_won` boolean NOT NULL DEFAULT false,
	`is_lost` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pipeline_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pipelines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pipelines_id` PRIMARY KEY(`id`)
);

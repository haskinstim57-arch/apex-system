CREATE TABLE `jarvis_scheduled_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`prompt` text NOT NULL,
	`schedule_description` varchar(255) NOT NULL,
	`cron_expression` varchar(100) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`last_run_at` timestamp,
	`next_run_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jarvis_scheduled_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jarvis_tool_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`tool_name` varchar(100) NOT NULL,
	`usage_count` int NOT NULL DEFAULT 0,
	`last_used_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jarvis_tool_usage_id` PRIMARY KEY(`id`)
);

CREATE TABLE `email_warming_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`start_daily_limit` int NOT NULL DEFAULT 5,
	`max_daily_limit` int NOT NULL DEFAULT 200,
	`ramp_up_per_day` int NOT NULL DEFAULT 5,
	`current_daily_limit` int NOT NULL DEFAULT 5,
	`warming_start_date` timestamp NOT NULL DEFAULT (now()),
	`today_send_count` int NOT NULL DEFAULT 0,
	`last_reset_date` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_warming_config_id` PRIMARY KEY(`id`)
);

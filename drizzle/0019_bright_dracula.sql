CREATE TABLE `calendar_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`account_id` int NOT NULL,
	`provider` enum('google','outlook') NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`token_expires_at` timestamp,
	`external_calendar_id` varchar(500) NOT NULL DEFAULT 'primary',
	`external_email` varchar(320),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_integrations_id` PRIMARY KEY(`id`)
);

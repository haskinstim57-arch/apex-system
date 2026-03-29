CREATE TABLE `push_notification_batch` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`event_count` int NOT NULL DEFAULT 1,
	`event_payloads` text,
	`status` enum('pending','sent','expired') NOT NULL DEFAULT 'pending',
	`window_start` timestamp NOT NULL DEFAULT (now()),
	`flush_at` timestamp NOT NULL,
	`sent_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_notification_batch_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD `notification_preferences` text;
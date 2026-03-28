CREATE TABLE `gmb_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`google_email` varchar(255) NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`token_expires_at` timestamp,
	`location_id` varchar(255),
	`location_name` varchar(255),
	`place_id` varchar(255),
	`auto_sync_enabled` boolean NOT NULL DEFAULT true,
	`last_sync_at` timestamp,
	`status` enum('active','expired','disconnected') NOT NULL DEFAULT 'active',
	`connected_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gmb_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reputation_alert_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`rating_threshold` int NOT NULL DEFAULT 2,
	`notify_email` boolean NOT NULL DEFAULT true,
	`notify_sms` boolean NOT NULL DEFAULT false,
	`notify_in_app` boolean NOT NULL DEFAULT true,
	`email_recipients` text,
	`sms_recipients` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reputation_alert_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `reputation_alert_settings_account_id_unique` UNIQUE(`account_id`)
);
--> statement-breakpoint
ALTER TABLE `reviews` ADD `replyBody` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `repliedAt` timestamp;
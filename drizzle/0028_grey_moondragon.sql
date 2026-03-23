CREATE TABLE `calendar_watches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`account_id` int NOT NULL,
	`integration_id` int NOT NULL,
	`provider` enum('google','outlook') NOT NULL,
	`watch_id` varchar(500) NOT NULL,
	`resource_id` varchar(500),
	`channel_token` varchar(500),
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calendar_watches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `external_calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`account_id` int NOT NULL,
	`provider` enum('google','outlook') NOT NULL,
	`external_event_id` varchar(500) NOT NULL,
	`title` varchar(500) NOT NULL,
	`start_time` timestamp NOT NULL,
	`end_time` timestamp NOT NULL,
	`all_day` boolean NOT NULL DEFAULT false,
	`status` varchar(50) NOT NULL DEFAULT 'confirmed',
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `external_calendar_events_id` PRIMARY KEY(`id`)
);

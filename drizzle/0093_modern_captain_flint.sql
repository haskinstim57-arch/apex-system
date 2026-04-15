CREATE TABLE `system_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int,
	`event_type` varchar(100) NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`title` varchar(500) NOT NULL,
	`details` text,
	`resolved` boolean NOT NULL DEFAULT false,
	`resolved_at` timestamp,
	`resolved_by` varchar(100),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `system_events_id` PRIMARY KEY(`id`)
);

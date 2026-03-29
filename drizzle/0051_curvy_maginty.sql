CREATE TABLE `contact_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`description` varchar(500),
	`icon` varchar(50),
	`color` varchar(30),
	`filter_config` text NOT NULL,
	`is_preset` boolean NOT NULL DEFAULT false,
	`contact_count` int NOT NULL DEFAULT 0,
	`count_refreshed_at` timestamp,
	`created_by_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_segments_id` PRIMARY KEY(`id`)
);

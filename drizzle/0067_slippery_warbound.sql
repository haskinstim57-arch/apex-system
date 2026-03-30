CREATE TABLE `jarvis_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'New conversation',
	`messages` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jarvis_sessions_id` PRIMARY KEY(`id`)
);

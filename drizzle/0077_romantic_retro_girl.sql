CREATE TABLE `notification_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channel` enum('push','email','sms') NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`account_id` int NOT NULL,
	`user_id` int,
	`recipient` varchar(320),
	`status` enum('sent','failed','skipped') NOT NULL DEFAULT 'sent',
	`error_message` text,
	`provider` varchar(50),
	`title` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_log_id` PRIMARY KEY(`id`)
);

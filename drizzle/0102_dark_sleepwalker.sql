CREATE TABLE `notification_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`user_id` int,
	`event_type` varchar(100) NOT NULL,
	`channel` enum('push','email','sms','in_app') NOT NULL,
	`dedupe_key` varchar(255) NOT NULL,
	`sent_at` timestamp NOT NULL DEFAULT (now()),
	`metadata` json,
	CONSTRAINT `notification_audit_log_id` PRIMARY KEY(`id`)
);

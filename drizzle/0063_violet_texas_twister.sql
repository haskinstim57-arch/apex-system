CREATE TABLE `queued_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`contact_id` int,
	`type` enum('sms','email','ai_call') NOT NULL,
	`status` enum('pending','dispatched','failed','cancelled') NOT NULL DEFAULT 'pending',
	`payload` text NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`max_attempts` int NOT NULL DEFAULT 3,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`dispatched_at` timestamp,
	`next_attempt_at` timestamp,
	`source` varchar(100) DEFAULT 'business_hours_queue',
	`initiated_by_id` int,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `queued_messages_id` PRIMARY KEY(`id`)
);

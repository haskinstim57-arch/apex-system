CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`user_id` int NOT NULL,
	`subject` varchar(500) NOT NULL,
	`category` enum('bug','feature','billing','general') NOT NULL DEFAULT 'general',
	`message` text NOT NULL,
	`screenshot_url` text,
	`status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`admin_notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`)
);

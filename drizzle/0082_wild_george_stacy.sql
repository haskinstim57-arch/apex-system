CREATE TABLE `email_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`created_by_user_id` int,
	`contact_id` int,
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`preview_text` varchar(255),
	`template_type` varchar(50) NOT NULL,
	`tone` varchar(50),
	`topic` varchar(500),
	`ai_model` varchar(100),
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`sent_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_drafts_id` PRIMARY KEY(`id`)
);

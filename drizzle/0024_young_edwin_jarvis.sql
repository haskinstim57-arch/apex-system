CREATE TABLE `email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`subject` varchar(500) NOT NULL DEFAULT '',
	`html_content` text,
	`json_blocks` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`)
);

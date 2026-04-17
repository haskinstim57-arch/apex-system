CREATE TABLE `support_ticket_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticket_id` int NOT NULL,
	`user_id` int NOT NULL,
	`author_type` enum('client','apex_staff') NOT NULL,
	`body` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_ticket_replies_id` PRIMARY KEY(`id`)
);

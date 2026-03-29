CREATE TABLE `custom_field_defs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`type` enum('text','number','date','dropdown','checkbox','textarea','url','email','phone') NOT NULL,
	`options` text,
	`required` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_field_defs_id` PRIMARY KEY(`id`)
);

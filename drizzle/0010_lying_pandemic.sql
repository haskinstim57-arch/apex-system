CREATE TABLE `facebook_page_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facebook_page_id` varchar(100) NOT NULL,
	`account_id` int NOT NULL,
	`page_name` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `facebook_page_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `facebook_page_mappings_facebook_page_id_unique` UNIQUE(`facebook_page_id`)
);

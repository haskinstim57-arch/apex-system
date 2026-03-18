CREATE TABLE `account_facebook_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`integration_id` int NOT NULL,
	`facebook_page_id` varchar(100) NOT NULL,
	`page_name` varchar(255),
	`page_access_token` text,
	`is_subscribed` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `account_facebook_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `account_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`provider` varchar(50) NOT NULL,
	`provider_user_id` varchar(255),
	`provider_user_name` varchar(255),
	`access_token` text,
	`refresh_token` text,
	`token_expires_at` timestamp,
	`is_active` boolean NOT NULL DEFAULT true,
	`connected_by_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `account_integrations_id` PRIMARY KEY(`id`)
);

CREATE TABLE `content_brand_voice` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`industry` varchar(100),
	`target_audience` varchar(255),
	`brand_personality` varchar(255),
	`key_messages` text,
	`avoid_topics` text,
	`preferred_tone` varchar(50) DEFAULT 'professional',
	`example_posts` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_brand_voice_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_brand_voice_account_id_unique` UNIQUE(`account_id`)
);
--> statement-breakpoint
CREATE TABLE `social_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`platform` enum('facebook','instagram','linkedin','twitter') NOT NULL,
	`platform_account_id` varchar(255) NOT NULL,
	`platform_account_name` varchar(255),
	`access_token` text,
	`refresh_token` text,
	`token_expires_at` timestamp,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`created_by_user_id` int NOT NULL,
	`platform` enum('facebook','instagram','linkedin','twitter') NOT NULL,
	`content` text NOT NULL,
	`hashtags` text,
	`image_url` text,
	`image_prompt` text,
	`status` enum('draft','scheduled','published','failed') NOT NULL DEFAULT 'draft',
	`scheduled_at` timestamp,
	`published_at` timestamp,
	`external_post_id` varchar(255),
	`generation_prompt` text,
	`tone` varchar(50),
	`topic` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_posts_id` PRIMARY KEY(`id`)
);

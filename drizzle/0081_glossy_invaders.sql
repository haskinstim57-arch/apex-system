CREATE TABLE `content_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100),
	`prompt` text,
	`structure` json,
	`is_public` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `long_form_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`created_by_user_id` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`topic` text NOT NULL,
	`content` text NOT NULL,
	`image_url` text,
	`image_prompt` text,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`ai_model` varchar(100),
	`custom_prompt` text,
	`input_tokens` int,
	`output_tokens` int,
	`total_tokens` int,
	`urls_fetched` int DEFAULT 0,
	`urls_failed` int DEFAULT 0,
	`web_searches` int DEFAULT 0,
	`word_count` int,
	`generation_time_ms` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `long_form_content_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repurposed_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`original_content_id` int NOT NULL,
	`format` enum('social-snippet','email-summary','short-form','infographic-script','video-script') NOT NULL,
	`content` text NOT NULL,
	`platform` varchar(50),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `repurposed_content_id` PRIMARY KEY(`id`)
);

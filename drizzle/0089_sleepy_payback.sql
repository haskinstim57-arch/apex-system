ALTER TABLE `messages` ADD `retry_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `retry_at` timestamp;
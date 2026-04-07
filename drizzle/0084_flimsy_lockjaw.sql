ALTER TABLE `email_signatures` ADD `usage_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `email_signatures` ADD `last_used_at` timestamp;
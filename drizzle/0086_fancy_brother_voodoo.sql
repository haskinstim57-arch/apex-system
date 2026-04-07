ALTER TABLE `jarvis_scheduled_tasks` ADD `last_run_result` text;--> statement-breakpoint
ALTER TABLE `jarvis_scheduled_tasks` ADD `run_count` int DEFAULT 0 NOT NULL;
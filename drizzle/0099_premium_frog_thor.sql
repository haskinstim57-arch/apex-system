ALTER TABLE `deals` ADD `assigned_user_id` int;--> statement-breakpoint
ALTER TABLE `deals` ADD `loss_reason` varchar(500);--> statement-breakpoint
ALTER TABLE `deals` ADD `stage_changed_at` timestamp DEFAULT (now()) NOT NULL;
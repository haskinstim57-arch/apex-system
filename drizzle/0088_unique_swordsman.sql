ALTER TABLE `messages` ADD `sequence_step_id` int;--> statement-breakpoint
ALTER TABLE `messages` ADD `sequence_step_position` int;--> statement-breakpoint
ALTER TABLE `sequences` ADD `activate_at` timestamp;
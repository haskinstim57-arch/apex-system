CREATE TABLE `contact_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contact_id` int NOT NULL,
	`account_id` int NOT NULL,
	`activity_type` enum('contact_created','tag_added','tag_removed','pipeline_stage_changed','message_sent','message_received','ai_call_made','appointment_booked','appointment_confirmed','appointment_cancelled','automation_triggered','note_added','task_created','task_completed') NOT NULL,
	`description` text NOT NULL,
	`metadata` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_activities_id` PRIMARY KEY(`id`)
);

CREATE TABLE `sequence_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sequence_id` int NOT NULL,
	`contact_id` int NOT NULL,
	`account_id` int NOT NULL,
	`current_step` int NOT NULL DEFAULT 0,
	`status` enum('active','completed','paused','failed','unenrolled') NOT NULL DEFAULT 'active',
	`next_step_at` timestamp,
	`last_step_at` timestamp,
	`enrolled_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`enrollment_source` varchar(50) DEFAULT 'manual',
	`source_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sequence_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sequence_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sequence_id` int NOT NULL,
	`position` int NOT NULL,
	`delay_days` int NOT NULL DEFAULT 0,
	`delay_hours` int NOT NULL DEFAULT 0,
	`message_type` enum('sms','email') NOT NULL,
	`subject` varchar(500),
	`content` text NOT NULL,
	`template_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sequence_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('active','paused','draft','archived') NOT NULL DEFAULT 'draft',
	`step_count` int NOT NULL DEFAULT 0,
	`active_enrollments` int NOT NULL DEFAULT 0,
	`completed_count` int NOT NULL DEFAULT 0,
	`created_by_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `workflow_steps` MODIFY COLUMN `actionType` enum('send_sms','send_email','start_ai_call','add_tag','remove_tag','update_contact_field','create_task','add_to_campaign','assign_pipeline_stage','notify_user','send_review_request','enroll_in_sequence');
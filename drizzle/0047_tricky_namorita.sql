CREATE TABLE `lead_score_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contact_id` int NOT NULL,
	`account_id` int NOT NULL,
	`rule_id` int,
	`event` varchar(100) NOT NULL,
	`delta` int NOT NULL,
	`score_before` int NOT NULL,
	`score_after` int NOT NULL,
	`reason` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_score_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_scoring_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`event` enum('contact_created','tag_added','pipeline_stage_changed','inbound_message_received','appointment_booked','appointment_cancelled','call_completed','missed_call','form_submitted','email_opened','link_clicked','facebook_lead_received') NOT NULL,
	`delta` int NOT NULL,
	`condition` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lead_scoring_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `leadScore` int DEFAULT 0 NOT NULL;
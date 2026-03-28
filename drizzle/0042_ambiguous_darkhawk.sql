CREATE TABLE `outbound_webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`trigger_event` enum('contact_created','contact_updated','tag_added','pipeline_stage_changed','facebook_lead_received','inbound_message_received','appointment_booked','appointment_cancelled','call_completed','missed_call','form_submitted','review_received','workflow_completed') NOT NULL,
	`url` text NOT NULL,
	`secret` varchar(128) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`description` text,
	`last_triggered_at` timestamp,
	`fail_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outbound_webhooks_id` PRIMARY KEY(`id`)
);

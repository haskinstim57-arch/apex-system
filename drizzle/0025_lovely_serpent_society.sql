CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`user_id` int,
	`type` enum('inbound_message','appointment_booked','appointment_cancelled','ai_call_completed','campaign_finished','workflow_failed','new_contact_facebook','new_contact_booking','missed_call') NOT NULL,
	`title` varchar(500) NOT NULL,
	`body` text,
	`link` varchar(500),
	`is_read` boolean NOT NULL DEFAULT false,
	`dismissed` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);

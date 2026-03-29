CREATE TABLE `sms_compliance_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`contact_id` int,
	`phone` varchar(30) NOT NULL,
	`event_type` enum('opt_out','opt_in','help_request','dnd_set','dnd_cleared','message_blocked','auto_reply_sent','manual_opt_out','manual_opt_in') NOT NULL,
	`keyword` varchar(50),
	`description` text,
	`metadata` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sms_compliance_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_opt_outs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`contact_id` int,
	`phone` varchar(30) NOT NULL,
	`keyword` varchar(50) NOT NULL,
	`source` enum('inbound_sms','manual','import','api') NOT NULL DEFAULT 'inbound_sms',
	`is_active` boolean NOT NULL DEFAULT true,
	`opted_in_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sms_opt_outs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `dnd_status` enum('active','dnd_sms','dnd_email','dnd_all') DEFAULT 'active' NOT NULL;
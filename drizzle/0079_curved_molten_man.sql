ALTER TABLE `notification_log` ADD `external_message_id` varchar(255);--> statement-breakpoint
ALTER TABLE `notification_log` ADD `delivery_status` varchar(50);--> statement-breakpoint
ALTER TABLE `notification_log` ADD `delivery_status_updated_at` timestamp;
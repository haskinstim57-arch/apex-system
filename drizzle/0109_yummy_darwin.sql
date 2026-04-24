ALTER TABLE `messages` MODIFY COLUMN `type` enum('email','sms','call') NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `callSid` varchar(64);--> statement-breakpoint
ALTER TABLE `messages` ADD `metadata` text;
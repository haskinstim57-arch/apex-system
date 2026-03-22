ALTER TABLE `accounts` ADD `missedCallTextBackEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `missedCallTextBackMessage` text DEFAULT ('Hey, sorry I missed your call! How can I help you?');--> statement-breakpoint
ALTER TABLE `accounts` ADD `missedCallTextBackDelayMinutes` int DEFAULT 1 NOT NULL;
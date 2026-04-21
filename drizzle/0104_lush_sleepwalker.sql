CREATE TABLE `jarvis_task_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`contactId` int NOT NULL,
	`taskType` varchar(100) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`payload` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `jarvis_task_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contacts` MODIFY COLUMN `status` enum('new','uncontacted','contacted','engaged','application_taken','application_in_progress','credit_repair','callback_scheduled','app_link_pending','qualified','proposal','negotiation','won','lost','nurture') NOT NULL DEFAULT 'uncontacted';--> statement-breakpoint
ALTER TABLE `contact_notes` ADD `isInternal` boolean DEFAULT false NOT NULL;
CREATE TABLE `form_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`accountId` int NOT NULL,
	`contactId` int,
	`data` json NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `form_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`fields` json NOT NULL,
	`settings` json,
	`submitAction` enum('create_contact','update_contact','notify_only') NOT NULL DEFAULT 'create_contact',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `forms_id` PRIMARY KEY(`id`),
	CONSTRAINT `forms_slug_unique` UNIQUE(`slug`)
);

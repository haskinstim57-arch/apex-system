CREATE TABLE `onboarding_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`user_id` int NOT NULL,
	`step` varchar(100) NOT NULL,
	`action` varchar(50) NOT NULL,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `onboarding_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `onboardingGoals` json;--> statement-breakpoint
ALTER TABLE `accounts` ADD `onboardingChecklistItems` json;--> statement-breakpoint
ALTER TABLE `accounts` ADD `onboardingCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `accounts` ADD `onboardingChecklistDismissedAt` timestamp;--> statement-breakpoint
ALTER TABLE `contacts` ADD `isDemoData` boolean DEFAULT false NOT NULL;
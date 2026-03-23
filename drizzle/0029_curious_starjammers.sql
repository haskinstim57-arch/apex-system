CREATE TABLE `dialer_scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dialer_scripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dialer_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`userId` int NOT NULL,
	`contactIds` text NOT NULL,
	`status` enum('active','paused','completed') NOT NULL DEFAULT 'active',
	`currentIndex` int NOT NULL DEFAULT 0,
	`results` text,
	`scriptId` int,
	`totalContacts` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `dialer_sessions_id` PRIMARY KEY(`id`)
);

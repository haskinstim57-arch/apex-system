CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`calendarId` int NOT NULL,
	`accountId` int NOT NULL,
	`contactId` int,
	`guestName` varchar(255) NOT NULL,
	`guestEmail` varchar(320) NOT NULL,
	`guestPhone` varchar(30),
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`status` enum('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`timezone` varchar(100) NOT NULL DEFAULT 'America/New_York',
	`bufferMinutes` int NOT NULL DEFAULT 15,
	`minNoticeHours` int NOT NULL DEFAULT 24,
	`maxDaysAhead` int NOT NULL DEFAULT 30,
	`slotDurationMinutes` int NOT NULL DEFAULT 30,
	`availabilityJson` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendars_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendars_slug_unique` UNIQUE(`slug`)
);

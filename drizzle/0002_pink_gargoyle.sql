CREATE TABLE `contact_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`authorId` int NOT NULL,
	`content` text NOT NULL,
	`isPinned` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`tag` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`email` varchar(320),
	`phone` varchar(30),
	`leadSource` varchar(100),
	`status` enum('new','contacted','qualified','proposal','negotiation','won','lost','nurture') NOT NULL DEFAULT 'new',
	`assignedUserId` int,
	`company` varchar(255),
	`title` varchar(255),
	`address` text,
	`city` varchar(100),
	`state` varchar(100),
	`zip` varchar(20),
	`dateOfBirth` timestamp,
	`customFields` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);

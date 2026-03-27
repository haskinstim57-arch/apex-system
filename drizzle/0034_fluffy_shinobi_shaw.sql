CREATE TABLE `ai_advisor_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`pageContext` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_advisor_messages_id` PRIMARY KEY(`id`)
);

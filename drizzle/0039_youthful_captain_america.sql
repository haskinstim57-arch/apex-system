CREATE TABLE `review_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`contactId` int NOT NULL,
	`platform` enum('google','facebook','yelp','zillow') NOT NULL,
	`channel` enum('sms','email') NOT NULL DEFAULT 'sms',
	`reviewUrl` text,
	`status` enum('pending','sent','clicked','completed','failed') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	`clickedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`platform` enum('google','facebook','yelp','zillow') NOT NULL,
	`rating` int NOT NULL,
	`body` text,
	`reviewerName` varchar(255),
	`reviewUrl` text,
	`externalId` varchar(255),
	`postedAt` timestamp,
	`contactId` int,
	`suggestedReply` text,
	`replySent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);

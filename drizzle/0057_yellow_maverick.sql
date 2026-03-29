ALTER TABLE `accounts` ADD `customDomain` varchar(255);--> statement-breakpoint
ALTER TABLE `accounts` ADD `primaryColor` varchar(20) DEFAULT '#d4a843';--> statement-breakpoint
ALTER TABLE `accounts` ADD `fromEmailDomain` varchar(255);--> statement-breakpoint
ALTER TABLE `accounts` ADD `emailDomainVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `brandName` varchar(255);--> statement-breakpoint
ALTER TABLE `accounts` ADD `faviconUrl` text;
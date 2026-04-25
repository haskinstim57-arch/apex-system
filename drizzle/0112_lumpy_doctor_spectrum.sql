CREATE TABLE `calendar_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`calendarId` int NOT NULL,
	`accountId` int NOT NULL,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`reason` varchar(255),
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calendar_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_cal_range` ON `calendar_blocks` (`calendarId`,`startTime`,`endTime`);
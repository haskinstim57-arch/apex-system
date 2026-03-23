CREATE TABLE `lead_routing_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`strategy` enum('round_robin','capacity_based','specific_user') NOT NULL DEFAULT 'round_robin',
	`assigneeIds` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`priority` int NOT NULL DEFAULT 0,
	`conditions` text,
	`roundRobinIndex` int NOT NULL DEFAULT 0,
	`maxLeadsPerUser` int NOT NULL DEFAULT 0,
	`applyToCsvImport` boolean NOT NULL DEFAULT true,
	`applyToFacebookLeads` boolean NOT NULL DEFAULT true,
	`applyToManualCreate` boolean NOT NULL DEFAULT false,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lead_routing_rules_id` PRIMARY KEY(`id`)
);

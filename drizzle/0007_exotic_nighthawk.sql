CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`contactId` int,
	`assignedUserId` int,
	`title` varchar(500) NOT NULL,
	`description` text,
	`status` enum('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`dueAt` timestamp,
	`completedAt` timestamp,
	`source` varchar(50) DEFAULT 'manual',
	`workflowExecutionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_execution_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` int NOT NULL,
	`stepId` int NOT NULL,
	`stepOrder` int NOT NULL,
	`stepType` enum('action','delay') NOT NULL,
	`actionType` varchar(50),
	`status` enum('pending','running','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`result` text,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`scheduledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_execution_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` int NOT NULL,
	`accountId` int NOT NULL,
	`contactId` int NOT NULL,
	`status` enum('running','completed','failed','paused','cancelled') NOT NULL DEFAULT 'running',
	`currentStep` int NOT NULL DEFAULT 1,
	`totalSteps` int NOT NULL DEFAULT 0,
	`nextStepAt` timestamp,
	`errorMessage` text,
	`triggeredBy` varchar(100),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` int NOT NULL,
	`stepOrder` int NOT NULL,
	`stepType` enum('action','delay') NOT NULL,
	`actionType` enum('send_sms','send_email','start_ai_call','add_tag','remove_tag','update_contact_field','create_task'),
	`delayType` enum('minutes','hours','days'),
	`delayValue` int,
	`config` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`triggerType` enum('contact_created','tag_added','pipeline_stage_changed','facebook_lead_received','manual') NOT NULL,
	`triggerConfig` text,
	`isActive` boolean NOT NULL DEFAULT false,
	`createdById` int NOT NULL,
	`executionCount` int NOT NULL DEFAULT 0,
	`lastExecutedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflows_id` PRIMARY KEY(`id`)
);

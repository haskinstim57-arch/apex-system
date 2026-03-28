ALTER TABLE `workflow_execution_steps` MODIFY COLUMN `stepType` enum('action','delay','condition') NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_steps` MODIFY COLUMN `stepType` enum('action','delay','condition') NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_steps` ADD `conditionConfig` text;
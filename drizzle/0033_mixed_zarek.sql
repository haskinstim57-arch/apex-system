ALTER TABLE `accounts` ADD `elevenLabsVoiceId` varchar(100);--> statement-breakpoint
ALTER TABLE `accounts` ADD `vapiAssistantId` varchar(100);--> statement-breakpoint
ALTER TABLE `accounts` ADD `vapiPhoneNumber` varchar(30);--> statement-breakpoint
ALTER TABLE `accounts` ADD `voiceAgentEnabled` boolean DEFAULT false NOT NULL;
ALTER TABLE `account_billing` ADD `sms_markup` decimal(5,3) DEFAULT '1.100' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `email_markup` decimal(5,3) DEFAULT '1.100' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `ai_call_markup` decimal(5,3) DEFAULT '1.100' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `voice_call_markup` decimal(5,3) DEFAULT '1.100' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `llm_markup` decimal(5,3) DEFAULT '1.100' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `dialer_markup` decimal(5,3) DEFAULT '1.100' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `sms_rebilling_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `email_rebilling_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `ai_call_rebilling_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `voice_call_rebilling_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `llm_rebilling_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `dialer_rebilling_enabled` boolean DEFAULT true NOT NULL;
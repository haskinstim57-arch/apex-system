ALTER TABLE `account_billing` MODIFY COLUMN `sms_markup` decimal(5,3) NOT NULL DEFAULT '2.500';--> statement-breakpoint
ALTER TABLE `account_billing` MODIFY COLUMN `email_markup` decimal(5,3) NOT NULL DEFAULT '2.500';--> statement-breakpoint
ALTER TABLE `account_billing` MODIFY COLUMN `ai_call_markup` decimal(5,3) NOT NULL DEFAULT '1.200';--> statement-breakpoint
ALTER TABLE `account_billing` MODIFY COLUMN `voice_call_markup` decimal(5,3) NOT NULL DEFAULT '2.500';--> statement-breakpoint
ALTER TABLE `account_billing` MODIFY COLUMN `llm_markup` decimal(5,3) NOT NULL DEFAULT '1.500';--> statement-breakpoint
ALTER TABLE `account_billing` MODIFY COLUMN `dialer_markup` decimal(5,3) NOT NULL DEFAULT '2.500';--> statement-breakpoint
ALTER TABLE `accounts` MODIFY COLUMN `status` enum('active','suspended','pending','billing_locked') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `account_billing` ADD `auto_recharge_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `auto_recharge_amount_cents` int DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `auto_recharge_threshold` decimal(10,4) DEFAULT '5.0000' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `recharge_attempts_today` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `account_billing` ADD `recharge_attempts_reset_at` timestamp;--> statement-breakpoint
ALTER TABLE `usage_events` ADD `refunded` boolean DEFAULT false NOT NULL;
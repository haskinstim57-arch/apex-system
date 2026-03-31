CREATE TABLE `account_billing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`billing_rate_id` int NOT NULL,
	`current_balance` decimal(10,4) NOT NULL DEFAULT '0.0000',
	`square_customer_id` varchar(255),
	`auto_invoice_threshold` decimal(10,4) NOT NULL DEFAULT '50.0000',
	`billing_email` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `account_billing_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_billing_account_id_unique` UNIQUE(`account_id`)
);
--> statement-breakpoint
CREATE TABLE `billing_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`amount` decimal(10,4) NOT NULL,
	`status` enum('draft','sent','paid','overdue','void') NOT NULL DEFAULT 'draft',
	`square_payment_link_id` varchar(255),
	`square_payment_link_url` varchar(1000),
	`square_payment_id` varchar(255),
	`square_invoice_id` varchar(255),
	`line_items` text,
	`period_start` timestamp,
	`period_end` timestamp,
	`due_date` timestamp,
	`paid_at` timestamp,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`sms_cost_per_unit` decimal(10,6) NOT NULL DEFAULT '0.015000',
	`email_cost_per_unit` decimal(10,6) NOT NULL DEFAULT '0.003000',
	`ai_call_cost_per_minute` decimal(10,6) NOT NULL DEFAULT '0.150000',
	`voice_call_cost_per_minute` decimal(10,6) NOT NULL DEFAULT '0.050000',
	`llm_cost_per_request` decimal(10,6) NOT NULL DEFAULT '0.020000',
	`power_dialer_cost_per_call` decimal(10,6) NOT NULL DEFAULT '0.030000',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usage_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`user_id` int,
	`event_type` enum('sms_sent','email_sent','ai_call_minute','voice_call_minute','llm_request','power_dialer_call') NOT NULL,
	`quantity` decimal(10,4) NOT NULL,
	`unit_cost` decimal(10,6) NOT NULL,
	`total_cost` decimal(10,4) NOT NULL,
	`metadata` text,
	`invoiced` boolean NOT NULL DEFAULT false,
	`invoice_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usage_events_id` PRIMARY KEY(`id`)
);

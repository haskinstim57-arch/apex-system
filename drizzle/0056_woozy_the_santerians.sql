CREATE TABLE `invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_id` int NOT NULL,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(10,2) NOT NULL DEFAULT '1',
	`unit_price` int NOT NULL,
	`amount` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`contact_id` int NOT NULL,
	`invoice_number` varchar(20) NOT NULL,
	`status` enum('draft','sent','paid','partially_paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
	`issue_date` timestamp NOT NULL DEFAULT (now()),
	`due_date` timestamp,
	`subtotal` int NOT NULL DEFAULT 0,
	`tax_rate` decimal(5,2),
	`tax_amount` int NOT NULL DEFAULT 0,
	`total` int NOT NULL DEFAULT 0,
	`amount_paid` int NOT NULL DEFAULT 0,
	`balance_due` int NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`notes` text,
	`square_payment_id` varchar(255),
	`square_payment_link` text,
	`square_order_id` varchar(255),
	`sent_at` timestamp,
	`paid_at` timestamp,
	`created_by_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`price` int NOT NULL,
	`type` enum('one_time','recurring') NOT NULL DEFAULT 'one_time',
	`description` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `workflow_steps` MODIFY COLUMN `actionType` enum('send_sms','send_email','start_ai_call','add_tag','remove_tag','update_contact_field','create_task','add_to_campaign','assign_pipeline_stage','notify_user','send_review_request','enroll_in_sequence','request_payment');
CREATE TABLE `port_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`phone_number` varchar(20) NOT NULL,
	`current_carrier` varchar(255),
	`carrier_account_number` varchar(255),
	`carrier_pin` varchar(100),
	`authorized_name` varchar(255),
	`porting_sid` varchar(100),
	`status` enum('draft','submitted','in_progress','completed','failed','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `port_requests_id` PRIMARY KEY(`id`)
);

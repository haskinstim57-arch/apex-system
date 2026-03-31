CREATE TABLE `payment_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`square_card_id` varchar(255) NOT NULL,
	`brand` varchar(50) NOT NULL,
	`last4` varchar(4) NOT NULL,
	`exp_month` int NOT NULL,
	`exp_year` int NOT NULL,
	`cardholder_name` varchar(255),
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_methods_id` PRIMARY KEY(`id`)
);

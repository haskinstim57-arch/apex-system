CREATE TABLE `account_messaging_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`twilio_account_sid` varchar(255),
	`twilio_auth_token` varchar(255),
	`twilio_from_number` varchar(50),
	`sendgrid_api_key` varchar(255),
	`sendgrid_from_email` varchar(255),
	`sendgrid_from_name` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `account_messaging_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_messaging_settings_account_id_unique` UNIQUE(`account_id`)
);

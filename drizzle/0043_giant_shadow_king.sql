CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`key_hash` varchar(128) NOT NULL,
	`key_prefix` varchar(20) NOT NULL,
	`permissions` json NOT NULL,
	`last_used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` timestamp,
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inbound_request_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int,
	`api_key_id` int,
	`endpoint` varchar(255) NOT NULL,
	`method` varchar(10) NOT NULL,
	`request_body` json,
	`response_status` int,
	`success` boolean NOT NULL DEFAULT false,
	`error_message` text,
	`ip_address` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inbound_request_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_delivery_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhook_id` int NOT NULL,
	`account_id` int NOT NULL,
	`event` varchar(100) NOT NULL,
	`request_url` text NOT NULL,
	`request_headers` json,
	`request_body` json,
	`response_status` int,
	`response_body` text,
	`latency_ms` int,
	`success` boolean NOT NULL DEFAULT false,
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_delivery_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `outbound_webhooks` ADD `conditions` json;
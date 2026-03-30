CREATE TABLE `gemini_usage_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int,
	`user_id` int,
	`endpoint` varchar(100) NOT NULL,
	`model` varchar(100) NOT NULL DEFAULT 'gemini-2.5-flash',
	`prompt_tokens` int NOT NULL DEFAULT 0,
	`completion_tokens` int NOT NULL DEFAULT 0,
	`total_tokens` int NOT NULL DEFAULT 0,
	`estimated_cost_usd` decimal(10,6) NOT NULL DEFAULT '0',
	`success` boolean NOT NULL DEFAULT true,
	`error_message` text,
	`duration_ms` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gemini_usage_logs_id` PRIMARY KEY(`id`)
);

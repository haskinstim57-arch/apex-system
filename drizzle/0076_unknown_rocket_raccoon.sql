CREATE TABLE `lead_routing_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`page_id` varchar(100),
	`lead_id` varchar(100),
	`account_id` int,
	`contact_id` int,
	`deal_id` int,
	`routing_method` enum('manual_mapping','oauth_page','payload_explicit','poller','unknown') NOT NULL DEFAULT 'unknown',
	`status` enum('success','failure','partial') NOT NULL DEFAULT 'success',
	`error_message` text,
	`response_time_ms` int,
	`source` enum('webhook_native','webhook_simplified','poller') NOT NULL DEFAULT 'webhook_native',
	`acknowledged` boolean NOT NULL DEFAULT false,
	`payload_snippet` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_routing_events_id` PRIMARY KEY(`id`)
);

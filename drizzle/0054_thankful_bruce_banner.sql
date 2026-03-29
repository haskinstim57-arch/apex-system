CREATE TABLE `chat_widgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`widget_key` varchar(64) NOT NULL,
	`greeting` text,
	`ai_enabled` boolean NOT NULL DEFAULT true,
	`ai_system_prompt` text,
	`handoff_keywords` text,
	`brand_color` varchar(20) NOT NULL DEFAULT '#6366f1',
	`position` enum('bottom-right','bottom-left') NOT NULL DEFAULT 'bottom-right',
	`allowed_domains` text,
	`collect_visitor_info` boolean NOT NULL DEFAULT true,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_widgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_widgets_widget_key_unique` UNIQUE(`widget_key`)
);
--> statement-breakpoint
CREATE TABLE `webchat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`account_id` int NOT NULL,
	`sender` enum('visitor','ai','agent') NOT NULL,
	`content` text NOT NULL,
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webchat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webchat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`widget_id` int NOT NULL,
	`account_id` int NOT NULL,
	`session_key` varchar(64) NOT NULL,
	`contact_id` int,
	`visitor_name` varchar(255),
	`visitor_email` varchar(320),
	`handoff_requested` boolean NOT NULL DEFAULT false,
	`agent_taken_over` boolean NOT NULL DEFAULT false,
	`agent_user_id` int,
	`status` enum('active','closed') NOT NULL DEFAULT 'active',
	`page_url` text,
	`ip_address` varchar(45),
	`user_agent` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webchat_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `webchat_sessions_session_key_unique` UNIQUE(`session_key`)
);

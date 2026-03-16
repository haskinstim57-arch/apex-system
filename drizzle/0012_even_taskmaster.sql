CREATE TABLE `impersonation_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`admin_id` int NOT NULL,
	`admin_name` varchar(255),
	`target_account_id` int NOT NULL,
	`target_account_name` varchar(255),
	`action` varchar(20) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `impersonation_audit_logs_id` PRIMARY KEY(`id`)
);

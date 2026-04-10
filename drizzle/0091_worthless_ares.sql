CREATE TABLE `gmb_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`review_id` varchar(255) NOT NULL,
	`reviewer_name` varchar(255),
	`reviewer_photo_url` text,
	`star_rating` enum('ONE','TWO','THREE','FOUR','FIVE') NOT NULL,
	`comment` text,
	`reply_text` text,
	`reply_updated_at` timestamp,
	`review_published_at` timestamp,
	`synced_at` timestamp DEFAULT (now()),
	CONSTRAINT `gmb_reviews_id` PRIMARY KEY(`id`)
);

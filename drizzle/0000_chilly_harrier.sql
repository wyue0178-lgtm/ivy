CREATE TABLE `print_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text NOT NULL,
	`contact` text NOT NULL,
	`desired_size` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`image_key` text NOT NULL,
	`image_name` text NOT NULL,
	`image_type` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

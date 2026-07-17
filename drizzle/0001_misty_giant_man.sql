CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`unit_price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`line_total` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_item_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_code` text NOT NULL,
	`owner_email` text NOT NULL,
	`partner_id` text NOT NULL,
	`total_amount` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_code_unique` ON `orders` (`order_code`);--> statement-breakpoint
CREATE INDEX `order_owner_idx` ON `orders` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `order_partner_idx` ON `orders` (`partner_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `medical_record_appointment_unique` ON `medical_records` (`appointment_id`);
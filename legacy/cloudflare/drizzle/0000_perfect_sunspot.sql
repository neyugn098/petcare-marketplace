CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`pet_id` text NOT NULL,
	`partner_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`reason` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `appointment_owner_idx` ON `appointments` (`owner_email`);--> statement-breakpoint
CREATE INDEX `appointment_partner_idx` ON `appointments` (`partner_id`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medical_records` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`partner_id` text NOT NULL,
	`appointment_id` text,
	`diagnosis` text NOT NULL,
	`treatment` text NOT NULL,
	`prescription` text DEFAULT '' NOT NULL,
	`clinician` text NOT NULL,
	`visited_at` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `medical_record_pet_idx` ON `medical_records` (`pet_id`,`visited_at`);--> statement-breakpoint
CREATE TABLE `partner_users` (
	`email` text NOT NULL,
	`partner_id` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_user_unique` ON `partner_users` (`email`,`partner_id`);--> statement-breakpoint
CREATE INDEX `partner_user_email_idx` ON `partner_users` (`email`);--> statement-breakpoint
CREATE TABLE `partners` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`address` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`phone` text NOT NULL,
	`rating` real DEFAULT 0 NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`open_now` integer DEFAULT false NOT NULL,
	`accepting_appointments` integer DEFAULT false NOT NULL,
	`hours` text NOT NULL,
	`services` text NOT NULL,
	`distance_km` real DEFAULT 0 NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`name` text NOT NULL,
	`species` text NOT NULL,
	`breed` text NOT NULL,
	`sex` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`weight_kg` real NOT NULL,
	`blood_type` text,
	`microchip` text,
	`allergies` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`avatar` text DEFAULT '🐕' NOT NULL,
	`qr_token` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pet_owner_idx` ON `pets` (`owner_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `pet_qr_token_unique` ON `pets` (`qr_token`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`price` integer NOT NULL,
	`original_price` integer,
	`visual` text NOT NULL,
	`visual_tone` text NOT NULL,
	`rating` real DEFAULT 0 NOT NULL,
	`sold` integer DEFAULT 0 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`badge` text,
	`description` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_partner_idx` ON `products` (`partner_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vaccinations` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`vaccine_name` text NOT NULL,
	`dose` text NOT NULL,
	`administered_at` text NOT NULL,
	`next_due_at` text,
	`provider_name` text NOT NULL,
	`batch_number` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `vaccination_pet_idx` ON `vaccinations` (`pet_id`);
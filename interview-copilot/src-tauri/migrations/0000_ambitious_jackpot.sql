CREATE TABLE `ai_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`task_type` text NOT NULL,
	`prompt` text NOT NULL,
	`answer` text NOT NULL,
	`key_points` text DEFAULT '[]' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_usd` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `document_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`session_id` text NOT NULL,
	`doc_type` text NOT NULL,
	`text` text NOT NULL,
	`order` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`doc_type` text NOT NULL,
	`original_file_name` text NOT NULL,
	`storage_file_name` text NOT NULL,
	`uploaded_at_ms` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hotkeys` (
	`action` text PRIMARY KEY NOT NULL,
	`combo` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `models` (
	`task_type` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`connection_status` text DEFAULT 'UNKNOWN' NOT NULL,
	`last_tested_at_ms` integer
);
--> statement-breakpoint
CREATE TABLE `screenshots` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`storage_path` text,
	`captured_at_ms` integer NOT NULL,
	`analysis` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_analysis` (
	`session_id` text PRIMARY KEY NOT NULL,
	`overall_score` integer NOT NULL,
	`category_scores` text NOT NULL,
	`strengths` text DEFAULT '[]' NOT NULL,
	`weaknesses` text DEFAULT '[]' NOT NULL,
	`missed_opportunities` text DEFAULT '[]' NOT NULL,
	`red_flags` text DEFAULT '[]' NOT NULL,
	`best_answers` text DEFAULT '[]' NOT NULL,
	`weakest_answers` text DEFAULT '[]' NOT NULL,
	`recommendations` text DEFAULT '[]' NOT NULL,
	`analyzed_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`start_time_ms` integer NOT NULL,
	`end_time_ms` integer,
	`mode` text DEFAULT 'AUTO' NOT NULL,
	`model_profile_override` text,
	`response_language` text DEFAULT 'en' NOT NULL,
	`response_mode` text DEFAULT 'SHORT' NOT NULL,
	`framework` text DEFAULT 'NONE' NOT NULL,
	`user_instructions` text DEFAULT '' NOT NULL,
	`summary` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transcript_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`speaker` text NOT NULL,
	`text` text NOT NULL,
	`timestamp_ms` integer NOT NULL,
	`confidence` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`experience_years` integer,
	`skills` text DEFAULT '[]' NOT NULL,
	`companies` text DEFAULT '[]' NOT NULL,
	`projects` text DEFAULT '[]' NOT NULL,
	`technologies` text DEFAULT '[]' NOT NULL,
	`achievements` text DEFAULT '[]' NOT NULL,
	`preferred_answer_style` text DEFAULT '' NOT NULL,
	`created_at_ms` integer NOT NULL
);

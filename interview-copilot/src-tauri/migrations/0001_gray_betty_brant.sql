PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ai_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`task_type` text NOT NULL,
	`prompt` text NOT NULL,
	`answer` text NOT NULL,
	`key_points` text DEFAULT '[]' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_usd` real,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_ai_responses`("id", "session_id", "task_type", "prompt", "answer", "key_points", "created_at_ms", "input_tokens", "output_tokens", "estimated_cost_usd") SELECT "id", "session_id", "task_type", "prompt", "answer", "key_points", "created_at_ms", "input_tokens", "output_tokens", "estimated_cost_usd" FROM `ai_responses`;--> statement-breakpoint
DROP TABLE `ai_responses`;--> statement-breakpoint
ALTER TABLE `__new_ai_responses` RENAME TO `ai_responses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
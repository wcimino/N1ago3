ALTER TABLE "conversations_summary" ADD COLUMN "customer_request_type" text;--> statement-breakpoint
ALTER TABLE "conversations_summary" ADD COLUMN "objective_problems" json;
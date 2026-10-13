ALTER TABLE "customers" ADD COLUMN "social_links" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "social_links" jsonb DEFAULT '{}'::jsonb NOT NULL;
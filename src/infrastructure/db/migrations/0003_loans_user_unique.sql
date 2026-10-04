DROP INDEX "loans_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "loans_user_uq" ON "loans" USING btree ("user_id");
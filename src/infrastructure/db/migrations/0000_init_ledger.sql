CREATE TYPE "public"."evidence_type" AS ENUM('PAYMENT_SLIP', 'RECEIPT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('MOBILE_BANKING', 'COUNTER', 'ATM', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('ACTIVE', 'VOIDED');--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"loan_number" text,
	"opening_balance" numeric(12, 2) NOT NULL,
	"opening_balance_date" date NOT NULL,
	"default_amount" numeric(12, 2),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_corrections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"original_payment_id" uuid NOT NULL,
	"replacement_payment_id" uuid,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"type" "evidence_type" NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"original_filename" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"paid_at" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"reference_no" text,
	"notes" text,
	"status" "payment_status" NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"replaced_by_payment_id" uuid,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_corrections" ADD CONSTRAINT "payment_corrections_original_payment_id_payments_id_fk" FOREIGN KEY ("original_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_corrections" ADD CONSTRAINT "payment_corrections_replacement_payment_id_payments_id_fk" FOREIGN KEY ("replacement_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence" ADD CONSTRAINT "payment_evidence_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loans_user_idx" ON "loans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_corrections_replacement_idx" ON "payment_corrections" USING btree ("replacement_payment_id");--> statement-breakpoint
CREATE INDEX "payment_evidence_payment_idx" ON "payment_evidence" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_loan_user_idx" ON "payments" USING btree ("loan_id","user_id");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id");
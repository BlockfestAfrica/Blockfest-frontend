CREATE TYPE "public"."admin_role" AS ENUM('owner', 'reviewer');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'coming_soon', 'active', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."challenge_status" AS ENUM('draft', 'active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."challenge_type" AS ENUM('regular', 'wildcard', 'final');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'suspended', 'disqualified');--> statement-breakpoint
CREATE TYPE "public"."ledger_source" AS ENUM('challenge_entry', 'quality_bonus', 'engagement_milestone', 'featured_blockfest', 'featured_monica', 'collab', 'wildcard_win', 'referral', 'manual_adjustment');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('x', 'instagram', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."vote_round_status" AS ENUM('draft', 'open', 'closed', 'published');--> statement-breakpoint
CREATE TYPE "public"."vote_status" AS ENUM('counted', 'removed');--> statement-breakpoint
CREATE TYPE "public"."winner_category" AS ENUM('creator_of_week', 'community_favourite');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_canonical" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "admin_role" DEFAULT 'reviewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"actor_admin_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"referral_code" text NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"points_total" integer DEFAULT 0 NOT NULL,
	"approved_entries_count" integer DEFAULT 0 NOT NULL,
	"first_approved_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "points_total_non_negative" CHECK ("campaign_creators"."points_total" >= 0),
	CONSTRAINT "approved_entries_non_negative" CHECK ("campaign_creators"."approved_entries_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"timezone" text DEFAULT 'Africa/Lagos' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_dates_ordered" CHECK ("campaigns"."ends_at" > "campaigns"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "challenge_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_creator_id" uuid NOT NULL,
	"challenge_id" uuid NOT NULL,
	"approved_platform_count" smallint DEFAULT 0 NOT NULL,
	"awarded_points" integer DEFAULT 0 NOT NULL,
	"base_points_snapshot" integer NOT NULL,
	"bonus_2_snapshot" integer NOT NULL,
	"bonus_3_snapshot" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approved_platform_count_range" CHECK ("challenge_entries"."approved_platform_count" BETWEEN 0 AND 3),
	CONSTRAINT "awarded_points_non_negative" CHECK ("challenge_entries"."awarded_points" >= 0),
	CONSTRAINT "bonus_tiers_monotonic" CHECK ("challenge_entries"."bonus_3_snapshot" >= "challenge_entries"."bonus_2_snapshot" AND "challenge_entries"."bonus_2_snapshot" >= 0)
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"week_no" smallint NOT NULL,
	"stage" smallint,
	"type" "challenge_type" DEFAULT 'regular' NOT NULL,
	"status" "challenge_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"base_points" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_week_range" CHECK ("challenges"."week_no" BETWEEN 1 AND 5),
	CONSTRAINT "challenge_stage_range" CHECK ("challenges"."stage" IS NULL OR "challenges"."stage" BETWEEN 1 AND 4),
	CONSTRAINT "challenge_dates_ordered" CHECK ("challenges"."ends_at" > "challenges"."starts_at"),
	CONSTRAINT "challenge_base_points_positive" CHECK ("challenges"."base_points" > 0)
);
--> statement-breakpoint
CREATE TABLE "creator_social_handles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"handle" text NOT NULL,
	"handle_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"email_canonical" text NOT NULL,
	"phone" text NOT NULL,
	"phone_e164" text NOT NULL,
	"content_niche" text NOT NULL,
	"audience_size" integer,
	"location" text,
	"registration_ip" text,
	"registration_user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creators_audience_size_sane" CHECK ("creators"."audience_size" IS NULL OR "creators"."audience_size" >= 0)
);
--> statement-breakpoint
CREATE TABLE "point_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_creator_id" uuid NOT NULL,
	"source" "ledger_source" NOT NULL,
	"points" integer NOT NULL,
	"entry_id" uuid,
	"note" text,
	"awarded_by_admin_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_points_non_zero" CHECK ("point_ledger"."points" <> 0),
	CONSTRAINT "ledger_entry_id_iff_entry_source" CHECK (("point_ledger"."source" = 'challenge_entry' AND "point_ledger"."entry_id" IS NOT NULL)
          OR ("point_ledger"."source" <> 'challenge_entry' AND "point_ledger"."entry_id" IS NULL)),
	CONSTRAINT "ledger_manual_awards_attributed" CHECK ("point_ledger"."source" = 'challenge_entry'
          OR "point_ledger"."source" = 'referral'
          OR ("point_ledger"."awarded_by_admin_id" IS NOT NULL AND "point_ledger"."note" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "point_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"key" text NOT NULL,
	"default_points" integer NOT NULL,
	"min_points" integer,
	"max_points" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_admin_id" uuid,
	CONSTRAINT "point_rule_bounds_ordered" CHECK (("point_rules"."min_points" IS NULL OR "point_rules"."max_points" IS NULL OR "point_rules"."min_points" <= "point_rules"."max_points"))
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"referrer_campaign_creator_id" uuid NOT NULL,
	"referred_campaign_creator_id" uuid NOT NULL,
	"code_used" text NOT NULL,
	"awarded_ledger_id" uuid,
	"awarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "no_self_referral" CHECK ("referrals"."referrer_campaign_creator_id" <> "referrals"."referred_campaign_creator_id"),
	CONSTRAINT "referral_award_consistent" CHECK (("referrals"."awarded_ledger_id" IS NULL AND "referrals"."awarded_at" IS NULL)
          OR ("referrals"."awarded_ledger_id" IS NOT NULL AND "referrals"."awarded_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"section" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"url" text,
	"display_order" smallint DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_admin_id" uuid,
	CONSTRAINT "resource_has_content" CHECK ("resources"."body" IS NOT NULL OR "resources"."url" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"url" text NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_admin_id" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_reviewed_consistently" CHECK (("submissions"."status" = 'pending' AND "submissions"."reviewed_at" IS NULL)
          OR ("submissions"."status" <> 'pending' AND "submissions"."reviewed_at" IS NOT NULL)),
	CONSTRAINT "submission_url_is_http" CHECK ("submissions"."url" ~* '^https://')
);
--> statement-breakpoint
CREATE TABLE "vote_round_nominees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"display_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"week_no" smallint NOT NULL,
	"status" "vote_round_status" DEFAULT 'draft' NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_window_ordered" CHECK ("vote_rounds"."closes_at" > "vote_rounds"."opens_at"),
	CONSTRAINT "round_week_range" CHECK ("vote_rounds"."week_no" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"nominee_id" uuid NOT NULL,
	"voter_email_canonical" text NOT NULL,
	"verified_at" timestamp with time zone,
	"status" "vote_status" DEFAULT 'counted' NOT NULL,
	"removed_reason" text,
	"removed_by_admin_id" uuid,
	"ip_hash" text,
	"user_agent" text,
	"bot_check_passed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_removal_explained" CHECK ("votes"."status" = 'counted' OR "votes"."removed_reason" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "weekly_winners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"week_no" smallint NOT NULL,
	"category" "winner_category" NOT NULL,
	"campaign_creator_id" uuid NOT NULL,
	"entry_id" uuid,
	"prize_amount_naira" integer NOT NULL,
	"note" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "winner_week_range" CHECK ("weekly_winners"."week_no" BETWEEN 1 AND 4),
	CONSTRAINT "winner_prize_positive" CHECK ("weekly_winners"."prize_amount_naira" > 0)
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_admin_id_admin_users_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_creators" ADD CONSTRAINT "campaign_creators_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_creators" ADD CONSTRAINT "campaign_creators_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_entries" ADD CONSTRAINT "challenge_entries_campaign_creator_id_campaign_creators_id_fk" FOREIGN KEY ("campaign_creator_id") REFERENCES "public"."campaign_creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_entries" ADD CONSTRAINT "challenge_entries_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_social_handles" ADD CONSTRAINT "creator_social_handles_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_campaign_creator_id_campaign_creators_id_fk" FOREIGN KEY ("campaign_creator_id") REFERENCES "public"."campaign_creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_entry_id_challenge_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."challenge_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_awarded_by_admin_id_admin_users_id_fk" FOREIGN KEY ("awarded_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_rules" ADD CONSTRAINT "point_rules_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_rules" ADD CONSTRAINT "point_rules_updated_by_admin_id_admin_users_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_campaign_creator_id_campaign_creators_id_fk" FOREIGN KEY ("referrer_campaign_creator_id") REFERENCES "public"."campaign_creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_campaign_creator_id_campaign_creators_id_fk" FOREIGN KEY ("referred_campaign_creator_id") REFERENCES "public"."campaign_creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_awarded_ledger_id_point_ledger_id_fk" FOREIGN KEY ("awarded_ledger_id") REFERENCES "public"."point_ledger"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_updated_by_admin_id_admin_users_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_entry_id_challenge_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."challenge_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewed_by_admin_id_admin_users_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_round_nominees" ADD CONSTRAINT "vote_round_nominees_round_id_vote_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."vote_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_round_nominees" ADD CONSTRAINT "vote_round_nominees_entry_id_challenge_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."challenge_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_rounds" ADD CONSTRAINT "vote_rounds_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_round_id_vote_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."vote_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_nominee_id_vote_round_nominees_id_fk" FOREIGN KEY ("nominee_id") REFERENCES "public"."vote_round_nominees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_removed_by_admin_id_admin_users_id_fk" FOREIGN KEY ("removed_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_winners" ADD CONSTRAINT "weekly_winners_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_winners" ADD CONSTRAINT "weekly_winners_campaign_creator_id_campaign_creators_id_fk" FOREIGN KEY ("campaign_creator_id") REFERENCES "public"."campaign_creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_winners" ADD CONSTRAINT "weekly_winners_entry_id_challenge_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."challenge_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_email_key" ON "admin_users" USING btree ("email_canonical");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_campaign_idx" ON "audit_log" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_creator_unique" ON "campaign_creators" USING btree ("campaign_id","creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_code_key" ON "campaign_creators" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "leaderboard_idx" ON "campaign_creators" USING btree ("campaign_id","points_total" DESC NULLS LAST,"approved_entries_count" DESC NULLS LAST,"first_approved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_slug_key" ON "campaigns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_unique" ON "challenge_entries" USING btree ("campaign_creator_id","challenge_id");--> statement-breakpoint
CREATE INDEX "entry_creator_idx" ON "challenge_entries" USING btree ("campaign_creator_id");--> statement-breakpoint
CREATE INDEX "entry_challenge_idx" ON "challenge_entries" USING btree ("challenge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_regular_challenge_per_week" ON "challenges" USING btree ("campaign_id","week_no") WHERE type = 'regular';--> statement-breakpoint
CREATE INDEX "challenges_campaign_status_idx" ON "challenges" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "social_handle_unique" ON "creator_social_handles" USING btree ("platform","handle_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "social_handle_one_per_creator_platform" ON "creator_social_handles" USING btree ("creator_id","platform");--> statement-breakpoint
CREATE INDEX "social_handle_creator_idx" ON "creator_social_handles" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_email_canonical_key" ON "creators" USING btree ("email_canonical");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_phone_e164_key" ON "creators" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX "ledger_creator_idx" ON "point_ledger" USING btree ("campaign_creator_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_entry_idx" ON "point_ledger" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_idempotency_key" ON "point_ledger" USING btree ("idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "point_rule_key_unique" ON "point_rules" USING btree ("campaign_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "referred_once_ever" ON "referrals" USING btree ("referred_campaign_creator_id");--> statement-breakpoint
CREATE INDEX "referrer_idx" ON "referrals" USING btree ("referrer_campaign_creator_id");--> statement-breakpoint
CREATE INDEX "resources_section_idx" ON "resources" USING btree ("campaign_id","section","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_one_per_platform" ON "submissions" USING btree ("entry_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_url_unique" ON "submissions" USING btree ("url");--> statement-breakpoint
CREATE INDEX "submission_status_idx" ON "submissions" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "submission_entry_idx" ON "submissions" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nominee_unique_per_round" ON "vote_round_nominees" USING btree ("round_id","entry_id");--> statement-breakpoint
CREATE INDEX "nominee_round_idx" ON "vote_round_nominees" USING btree ("round_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_round_per_week" ON "vote_rounds" USING btree ("campaign_id","week_no");--> statement-breakpoint
CREATE UNIQUE INDEX "one_counted_vote_per_person_per_round" ON "votes" USING btree ("round_id","voter_email_canonical") WHERE status = 'counted';--> statement-breakpoint
CREATE INDEX "vote_tally_idx" ON "votes" USING btree ("nominee_id","status");--> statement-breakpoint
CREATE INDEX "vote_ip_review_idx" ON "votes" USING btree ("round_id","ip_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "one_winner_per_category_per_week" ON "weekly_winners" USING btree ("campaign_id","week_no","category");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_of_week_once_per_campaign" ON "weekly_winners" USING btree ("campaign_id","campaign_creator_id") WHERE category = 'creator_of_week';--> statement-breakpoint
CREATE INDEX "winners_published_idx" ON "weekly_winners" USING btree ("campaign_id","published_at");
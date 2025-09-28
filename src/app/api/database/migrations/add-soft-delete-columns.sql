-- Add soft delete columns to all relevant tables
-- This script adds deletedAt and deletedBy columns for soft delete functionality

-- Add soft delete to user table
ALTER TABLE public.user 
ADD COLUMN "deletedAt" timestamp without time zone DEFAULT NULL,
ADD COLUMN "deletedBy" integer DEFAULT NULL,
ADD CONSTRAINT user_deletedBy_fkey FOREIGN KEY ("deletedBy") REFERENCES public.user(id);

-- Add soft delete to post table
ALTER TABLE public.post 
ADD COLUMN "deletedAt" timestamp without time zone DEFAULT NULL,
ADD COLUMN "deletedBy" integer DEFAULT NULL,
ADD CONSTRAINT post_deletedBy_fkey FOREIGN KEY ("deletedBy") REFERENCES public.user(id);

-- Add soft delete to listing table
ALTER TABLE public.listing 
ADD COLUMN "deletedAt" timestamp without time zone DEFAULT NULL,
ADD COLUMN "deletedBy" integer DEFAULT NULL,
ADD CONSTRAINT listing_deletedBy_fkey FOREIGN KEY ("deletedBy") REFERENCES public.user(id);

-- Add soft delete to comment table
ALTER TABLE public.comment 
ADD COLUMN "deletedAt" timestamp without time zone DEFAULT NULL,
ADD COLUMN "deletedBy" integer DEFAULT NULL,
ADD CONSTRAINT comment_deletedBy_fkey FOREIGN KEY ("deletedBy") REFERENCES public.user(id);

-- Add soft delete to message table
ALTER TABLE public.message 
ADD COLUMN "deletedAt" timestamp without time zone DEFAULT NULL,
ADD COLUMN "deletedBy" integer DEFAULT NULL,
ADD CONSTRAINT message_deletedBy_fkey FOREIGN KEY ("deletedBy") REFERENCES public.user(id);

-- Add soft delete to media table
ALTER TABLE public.media 
ADD COLUMN "deletedAt" timestamp without time zone DEFAULT NULL,
ADD COLUMN "deletedBy" integer DEFAULT NULL,
ADD CONSTRAINT media_deletedBy_fkey FOREIGN KEY ("deletedBy") REFERENCES public.user(id);

-- Add soft delete to profile table
ALTER TABLE public.profile 
ADD COLUMN "deletedAt" timestamp without time zone DEFAULT NULL,
ADD COLUMN "deletedBy" integer DEFAULT NULL,
ADD CONSTRAINT profile_deletedBy_fkey FOREIGN KEY ("deletedBy") REFERENCES public.user(id);

-- Create sequence for admin action log (must be created before the table)
CREATE SEQUENCE IF NOT EXISTS admin_action_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Create admin action log table for tracking deletions and restorations
CREATE TABLE public.admin_action_log (
  id integer NOT NULL DEFAULT nextval('admin_action_log_id_seq'::regclass),
  "adminId" integer NOT NULL,
  action character varying NOT NULL, -- 'soft_delete', 'restore', 'permanent_delete'
  "targetTable" character varying NOT NULL,
  "targetId" integer NOT NULL,
  reason text,
  metadata jsonb, -- Store additional data like original values
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT admin_action_log_pkey PRIMARY KEY (id),
  CONSTRAINT admin_action_log_adminId_fkey FOREIGN KEY ("adminId") REFERENCES public.user(id)
);

-- Create indexes for performance
CREATE INDEX idx_user_deleted_at ON public.user("deletedAt") WHERE "deletedAt" IS NOT NULL;
CREATE INDEX idx_post_deleted_at ON public.post("deletedAt") WHERE "deletedAt" IS NOT NULL;
CREATE INDEX idx_listing_deleted_at ON public.listing("deletedAt") WHERE "deletedAt" IS NOT NULL;
CREATE INDEX idx_comment_deleted_at ON public.comment("deletedAt") WHERE "deletedAt" IS NOT NULL;
CREATE INDEX idx_message_deleted_at ON public.message("deletedAt") WHERE "deletedAt" IS NOT NULL;
CREATE INDEX idx_media_deleted_at ON public.media("deletedAt") WHERE "deletedAt" IS NOT NULL;
CREATE INDEX idx_profile_deleted_at ON public.profile("deletedAt") WHERE "deletedAt" IS NOT NULL;

-- Create index for cleanup job (find records older than 60 days)
CREATE INDEX idx_admin_action_log_cleanup ON public.admin_action_log("createdAt", action) 
WHERE action = 'soft_delete';

-- Add comments to document the soft delete functionality
COMMENT ON COLUMN public.user."deletedAt" IS 'Timestamp when record was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN public.user."deletedBy" IS 'ID of admin user who performed the soft delete';
COMMENT ON COLUMN public.post."deletedAt" IS 'Timestamp when record was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN public.post."deletedBy" IS 'ID of admin user who performed the soft delete';
COMMENT ON COLUMN public.listing."deletedAt" IS 'Timestamp when record was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN public.listing."deletedBy" IS 'ID of admin user who performed the soft delete';
COMMENT ON COLUMN public.comment."deletedAt" IS 'Timestamp when record was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN public.comment."deletedBy" IS 'ID of admin user who performed the soft delete';
COMMENT ON COLUMN public.message."deletedAt" IS 'Timestamp when record was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN public.message."deletedBy" IS 'ID of admin user who performed the soft delete';
COMMENT ON COLUMN public.media."deletedAt" IS 'Timestamp when record was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN public.media."deletedBy" IS 'ID of admin user who performed the soft delete';
COMMENT ON COLUMN public.profile."deletedAt" IS 'Timestamp when record was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN public.profile."deletedBy" IS 'ID of admin user who performed the soft delete';
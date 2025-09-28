-- Cleanup script to permanently delete records that have been soft-deleted for more than 60 days
-- This should be run as a scheduled job

-- Function to permanently delete old soft-deleted records
CREATE OR REPLACE FUNCTION cleanup_old_deleted_records()
RETURNS TABLE(
    table_name text,
    records_cleaned integer,
    cleanup_date timestamp
) AS $$
DECLARE
    cutoff_date timestamp;
    deleted_count integer;
BEGIN
    -- Set cutoff date to 60 days ago
    cutoff_date := CURRENT_TIMESTAMP - INTERVAL '60 days';
    
    -- Log the cleanup operation
    INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, "createdAt")
    VALUES (1, 'cleanup_start', 'system', 0, 'Starting automated cleanup of records older than 60 days', CURRENT_TIMESTAMP);
    
    -- Clean up media files first (due to foreign key constraints)
    DELETE FROM media 
    WHERE "deletedAt" IS NOT NULL 
    AND "deletedAt" < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        table_name := 'media';
        records_cleaned := deleted_count;
        cleanup_date := CURRENT_TIMESTAMP;
        RETURN NEXT;
        
        INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, "createdAt")
        VALUES (1, 'permanent_delete', 'media', deleted_count, 
               format('Permanently deleted %s media records older than %s', deleted_count, cutoff_date), 
               CURRENT_TIMESTAMP);
    END IF;
    
    -- Clean up comments
    DELETE FROM comment 
    WHERE "deletedAt" IS NOT NULL 
    AND "deletedAt" < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        table_name := 'comment';
        records_cleaned := deleted_count;
        cleanup_date := CURRENT_TIMESTAMP;
        RETURN NEXT;
        
        INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, "createdAt")
        VALUES (1, 'permanent_delete', 'comment', deleted_count, 
               format('Permanently deleted %s comment records older than %s', deleted_count, cutoff_date), 
               CURRENT_TIMESTAMP);
    END IF;
    
    -- Clean up messages
    DELETE FROM message 
    WHERE "deletedAt" IS NOT NULL 
    AND "deletedAt" < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        table_name := 'message';
        records_cleaned := deleted_count;
        cleanup_date := CURRENT_TIMESTAMP;
        RETURN NEXT;
        
        INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, "createdAt")
        VALUES (1, 'permanent_delete', 'message', deleted_count, 
               format('Permanently deleted %s message records older than %s', deleted_count, cutoff_date), 
               CURRENT_TIMESTAMP);
    END IF;
    
    -- Clean up posts
    DELETE FROM post 
    WHERE "deletedAt" IS NOT NULL 
    AND "deletedAt" < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        table_name := 'post';
        records_cleaned := deleted_count;
        cleanup_date := CURRENT_TIMESTAMP;
        RETURN NEXT;
        
        INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, "createdAt")
        VALUES (1, 'permanent_delete', 'post', deleted_count, 
               format('Permanently deleted %s post records older than %s', deleted_count, cutoff_date), 
               CURRENT_TIMESTAMP);
    END IF;
    
    -- Clean up listings
    DELETE FROM listing 
    WHERE "deletedAt" IS NOT NULL 
    AND "deletedAt" < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        table_name := 'listing';
        records_cleaned := deleted_count;
        cleanup_date := CURRENT_TIMESTAMP;
        RETURN NEXT;
        
        INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, "createdAt")
        VALUES (1, 'permanent_delete', 'listing', deleted_count, 
               format('Permanently deleted %s listing records older than %s', deleted_count, cutoff_date), 
               CURRENT_TIMESTAMP);
    END IF;
    
    -- Clean up profiles
    DELETE FROM profile 
    WHERE "deletedAt" IS NOT NULL 
    AND "deletedAt" < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        table_name := 'profile';
        records_cleaned := deleted_count;
        cleanup_date := CURRENT_TIMESTAMP;
        RETURN NEXT;
        
        INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, "createdAt")
        VALUES (1, 'permanent_delete', 'profile', deleted_count, 
               format('Permanently deleted %s profile records older than %s', deleted_count, cutoff_date), 
               CURRENT_TIMESTAMP);
    END IF;
    
    -- Clean up users (last due to foreign key constraints)
    DELETE FROM "user" 
    WHERE "deletedAt" IS NOT NULL 
    AND "deletedAt" < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        table_name := 'user';
        records_cleaned := deleted_count;
        cleanup_date := CURRENT_TIMESTAMP;
        RETURN NEXT;
        
        INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, "createdAt")
        VALUES (1, 'permanent_delete', 'user', deleted_count, 
               format('Permanently deleted %s user records older than %s', deleted_count, cutoff_date), 
               CURRENT_TIMESTAMP);
    END IF;
    
    -- Clean up old admin action logs (keep for 1 year)
    DELETE FROM admin_action_log 
    WHERE "createdAt" < CURRENT_TIMESTAMP - INTERVAL '365 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        table_name := 'admin_action_log';
        records_cleaned := deleted_count;
        cleanup_date := CURRENT_TIMESTAMP;
        RETURN NEXT;
    END IF;
    
    -- Log completion
    INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, "createdAt")
    VALUES (1, 'cleanup_complete', 'system', 0, 'Completed automated cleanup', CURRENT_TIMESTAMP);
    
END;
$$ LANGUAGE plpgsql;

-- Create a manual cleanup trigger that can be called
-- Usage: SELECT * FROM cleanup_old_deleted_records();
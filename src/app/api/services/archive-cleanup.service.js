const { query, queryOne } = require('../config/database');
const cron = require('node-cron');

/**
 * Archive Cleanup Service
 * Automatically cleans up soft-deleted records that are older than 60 days
 * Runs daily and logs all cleanup operations
 */
class ArchiveCleanupService {
  constructor() {
    this.isRunning = false;
    this.lastCleanupTime = null;
    this.cleanupSchedule = '0 2 * * *'; // Run at 2 AM daily
  }

  /**
   * Start the automated cleanup service
   */
  start() {
    console.log('🧹 Starting Archive Cleanup Service...');
    
    // Schedule daily cleanup at 2 AM
    cron.schedule(this.cleanupSchedule, async () => {
      console.log('🧹 Running scheduled archive cleanup...');
      await this.runCleanup();
    });

    // Run initial cleanup if needed (optional)
    // this.runCleanup();
    
    console.log(`🧹 Archive Cleanup Service scheduled to run daily at 2 AM`);
  }

  /**
   * Run the cleanup process
   */
  async runCleanup() {
    if (this.isRunning) {
      console.log('🧹 Cleanup already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    
    try {
      console.log('🧹 Starting archive cleanup process...');
      
      // Log cleanup start
      await this.logCleanupAction('cleanup_start', 'system', 0, 
        'Starting automated cleanup of records older than 60 days');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 60);

      let totalCleaned = 0;
      const cleanupResults = {};

      // Define cleanup order (respecting foreign key constraints)
      const tablesToClean = [
        'media',
        'comment', 
        'message',
        'notification',
        'post',
        'listing',
        'profile',
        'user'
      ];

      for (const tableName of tablesToClean) {
        const cleaned = await this.cleanupTable(tableName, cutoffDate);
        if (cleaned > 0) {
          cleanupResults[tableName] = cleaned;
          totalCleaned += cleaned;
          console.log(`🧹 Cleaned ${cleaned} records from ${tableName}`);
        }
      }

      // Clean up old admin action logs (keep for 1 year)
      const oldLogsDate = new Date();
      oldLogsDate.setFullYear(oldLogsDate.getFullYear() - 1);
      const oldLogsResult = await query(
        'DELETE FROM admin_action_log WHERE "createdAt" < $1',
        [oldLogsDate]
      );
      
      if (oldLogsResult.rowCount > 0) {
        cleanupResults['admin_action_log'] = oldLogsResult.rowCount;
        totalCleaned += oldLogsResult.rowCount;
        console.log(`🧹 Cleaned ${oldLogsResult.rowCount} old admin action logs`);
      }

      // Log cleanup completion
      await this.logCleanupAction('cleanup_complete', 'system', totalCleaned, 
        `Completed cleanup. Total records cleaned: ${totalCleaned}`, cleanupResults);

      this.lastCleanupTime = new Date();
      console.log(`🧹 Archive cleanup completed. Total records cleaned: ${totalCleaned}`);
      
    } catch (error) {
      console.error('🧹 Error during archive cleanup:', error);
      await this.logCleanupAction('cleanup_error', 'system', 0, 
        `Cleanup failed: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up a specific table
   */
  async cleanupTable(tableName, cutoffDate) {
    try {
      // First, get the records that will be deleted for logging
      const recordsToDelete = await query(
        `SELECT id FROM "${tableName}" WHERE "deletedAt" IS NOT NULL AND "deletedAt" < $1`,
        [cutoffDate]
      );

      if (recordsToDelete.length === 0) {
        return 0;
      }

      // Handle related data cleanup for specific tables
      for (const record of recordsToDelete) {
        await this.cleanupRelatedData(tableName, record.id);
      }

      // Permanently delete the records
      const result = await query(
        `DELETE FROM "${tableName}" WHERE "deletedAt" IS NOT NULL AND "deletedAt" < $1`,
        [cutoffDate]
      );

      if (result.rowCount > 0) {
        await this.logCleanupAction('permanent_delete', tableName, result.rowCount, 
          `Permanently deleted ${result.rowCount} ${tableName} records older than ${cutoffDate.toISOString()}`);
      }

      return result.rowCount;
    } catch (error) {
      console.error(`Error cleaning up ${tableName}:`, error);
      await this.logCleanupAction('cleanup_error', tableName, 0, 
        `Error cleaning ${tableName}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Clean up related data for specific table types
   */
  async cleanupRelatedData(tableName, recordId) {
    try {
      switch (tableName) {
        case 'post':
          // Clean up post-related data
          await query('DELETE FROM "like" WHERE "postId" = $1', [recordId]);
          await query('DELETE FROM save WHERE "postId" = $1', [recordId]);
          // Comments and media will be cleaned in their own cleanup cycle
          break;
          
        case 'user':
          // Clean up user-related data that isn't soft-deleted
          await query('DELETE FROM follow WHERE "followerId" = $1 OR "followingId" = $1', [recordId]);
          await query('DELETE FROM "like" WHERE "userId" = $1', [recordId]);
          await query('DELETE FROM save WHERE "userId" = $1', [recordId]);
          await query('DELETE FROM conversation WHERE "user1Id" = $1 OR "user2Id" = $1', [recordId]);
          await query('DELETE FROM report WHERE "reporterId" = $1', [recordId]);
          break;
          
        case 'listing':
          // Clean up listing-related data
          await query('DELETE FROM listing_details WHERE "listingId" = $1', [recordId]);
          break;
          
        case 'comment':
          // Clean up comment-related data
          await query('DELETE FROM "like" WHERE "commentId" = $1', [recordId]);
          break;
          
        case 'conversation':
          // Messages will be cleaned in their own cycle
          break;
      }
    } catch (error) {
      console.error(`Error cleaning related data for ${tableName} record ${recordId}:`, error);
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    try {
      const stats = {};
      
      // Count soft-deleted records by table
      const tables = ['user', 'post', 'listing', 'comment', 'message', 'media', 'profile'];
      
      for (const tableName of tables) {
        const result = await queryOne(
          `SELECT 
            COUNT(*) as total_deleted,
            COUNT(CASE WHEN "deletedAt" > CURRENT_TIMESTAMP - INTERVAL '60 days' THEN 1 END) as within_retention,
            COUNT(CASE WHEN "deletedAt" <= CURRENT_TIMESTAMP - INTERVAL '60 days' THEN 1 END) as ready_for_cleanup
           FROM "${tableName}" 
           WHERE "deletedAt" IS NOT NULL`
        );
        
        stats[tableName] = {
          totalDeleted: parseInt(result.total_deleted),
          withinRetention: parseInt(result.within_retention),
          readyForCleanup: parseInt(result.ready_for_cleanup)
        };
      }

      // Get last cleanup time
      const lastCleanup = await queryOne(
        `SELECT "createdAt" FROM admin_action_log 
         WHERE action = 'cleanup_complete' 
         ORDER BY "createdAt" DESC LIMIT 1`
      );

      return {
        stats,
        lastCleanupTime: lastCleanup?.createdAt || null,
        nextScheduledCleanup: this.getNextCleanupTime(),
        isRunning: this.isRunning
      };
    } catch (error) {
      console.error('Error getting cleanup stats:', error);
      throw error;
    }
  }

  /**
   * Get next scheduled cleanup time
   */
  getNextCleanupTime() {
    const now = new Date();
    const next = new Date();
    next.setHours(2, 0, 0, 0); // Next 2 AM
    
    if (next <= now) {
      next.setDate(next.getDate() + 1); // Tomorrow at 2 AM
    }
    
    return next;
  }

  /**
   * Manual cleanup trigger (for admin use)
   */
  async manualCleanup(adminId, reason = 'Manual cleanup triggered') {
    console.log(`🧹 Manual cleanup triggered by admin ${adminId}`);
    await this.logCleanupAction('manual_cleanup_start', 'system', adminId, reason);
    await this.runCleanup();
  }

  /**
   * Log cleanup actions
   */
  async logCleanupAction(action, targetTable, targetId, reason, metadata = null) {
    try {
      await query(
        `INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, metadata, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [1, action, targetTable, targetId, reason, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (error) {
      console.error('Error logging cleanup action:', error);
    }
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    console.log('🧹 Stopping Archive Cleanup Service...');
    // Note: node-cron doesn't provide a direct way to stop specific tasks
    // In a production environment, you'd want to track the task and destroy it
  }
}

module.exports = new ArchiveCleanupService();
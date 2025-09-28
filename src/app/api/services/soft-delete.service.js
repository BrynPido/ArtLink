const { query, queryOne, queryWithResult } = require('../config/database');

/**
 * Soft Delete Service
 * Provides functionality for soft deleting records instead of permanent deletion
 * Records are marked as deleted and can be restored within 60 days
 */
class SoftDeleteService {
  
  /**
   * Soft delete a record from any table
   * @param {string} tableName - Name of the table
   * @param {number} recordId - ID of the record to delete
   * @param {number} deletedBy - ID of the admin user performing the delete
   * @param {string} reason - Reason for deletion
   * @returns {Promise<boolean>} - Success status
   */
  async softDelete(tableName, recordId, deletedBy, reason = null) {
    try {
      // Check if record exists and is not already deleted
      const existing = await queryOne(
        `SELECT id, "deletedAt" FROM "${tableName}" WHERE id = $1`,
        [recordId]
      );

      if (!existing) {
        throw new Error(`Record with ID ${recordId} not found in ${tableName}`);
      }

      if (existing.deletedAt) {
        throw new Error(`Record with ID ${recordId} is already deleted`);
      }

      // Perform soft delete
      const result = await queryWithResult(
        `UPDATE "${tableName}" 
         SET "deletedAt" = CURRENT_TIMESTAMP, "deletedBy" = $1 
         WHERE id = $2`,
        [deletedBy, recordId]
      );

      // Log the action
      await this.logAdminAction(deletedBy, 'soft_delete', tableName, recordId, reason);

      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error soft deleting ${tableName} record ${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Restore a soft deleted record
   * @param {string} tableName - Name of the table
   * @param {number} recordId - ID of the record to restore
   * @param {number} restoredBy - ID of the admin user performing the restore
   * @param {string} reason - Reason for restoration
   * @returns {Promise<boolean>} - Success status
   */
  async restore(tableName, recordId, restoredBy, reason = null) {
    try {
      // Check if record exists and is deleted
      const existing = await queryOne(
        `SELECT id, "deletedAt" FROM "${tableName}" WHERE id = $1`,
        [recordId]
      );

      if (!existing) {
        throw new Error(`Record with ID ${recordId} not found in ${tableName}`);
      }

      if (!existing.deletedAt) {
        console.log(`Record ${recordId} is not deleted - already restored or never deleted`);
        // If record is already restored, consider it a success rather than an error
        return true;
      }

      // Check if record is within restoration window (60 days)
      const daysSinceDeleted = Math.floor(
        (Date.now() - new Date(existing.deletedAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceDeleted > 60) {
        throw new Error(`Record cannot be restored after 60 days (${daysSinceDeleted} days have passed)`);
      }

      // Perform restore
      console.log(`Attempting to restore ${tableName} record ${recordId}`);
      console.log(`Query: UPDATE "${tableName}" SET "deletedAt" = NULL, "deletedBy" = NULL WHERE id = ${recordId} AND "deletedAt" IS NOT NULL`);
      
      const result = await queryWithResult(
        `UPDATE "${tableName}" 
         SET "deletedAt" = NULL, "deletedBy" = NULL 
         WHERE id = $1 AND "deletedAt" IS NOT NULL`,
        [recordId]
      );

      console.log(`Restore query result:`, result);
      console.log(`Row count: ${result.rowCount}`);

      const success = result.rowCount > 0;
      console.log(`Restore operation success: ${success}`);

      // Log the action (don't let logging failure affect the restore result)
      try {
        await this.logAdminAction(restoredBy, 'restore', tableName, recordId, reason);
        console.log(`Successfully logged restore action`);
      } catch (logError) {
        console.error('Warning: Failed to log restore action:', logError);
      }

      // Double-check that the record was actually restored
      if (success) {
        const verifyRestore = await queryOne(
          `SELECT id, "deletedAt" FROM "${tableName}" WHERE id = $1`,
          [recordId]
        );
        console.log(`Verification check - Record ${recordId} deletedAt:`, verifyRestore?.deletedAt);
        
        if (verifyRestore && verifyRestore.deletedAt === null) {
          console.log(`✅ Restore verified successful for ${tableName} record ${recordId}`);
        } else {
          console.log(`❌ Restore verification failed for ${tableName} record ${recordId}`);
        }
      }

      return success;
    } catch (error) {
      console.error(`Error restoring ${tableName} record ${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Permanently delete a record (bypass soft delete)
   * Should only be used for immediate permanent deletion or cleanup
   * @param {string} tableName - Name of the table
   * @param {number} recordId - ID of the record to delete
   * @param {number} deletedBy - ID of the admin user performing the delete
   * @param {string} reason - Reason for permanent deletion
   * @returns {Promise<boolean>} - Success status
   */
  async permanentDelete(tableName, recordId, deletedBy, reason = 'Manual permanent deletion') {
    try {
      // Get record data before deletion for logging
      const record = await queryOne(`SELECT * FROM "${tableName}" WHERE id = $1`, [recordId]);
      
      if (!record) {
        throw new Error(`Record with ID ${recordId} not found in ${tableName}`);
      }

      // Delete related data based on table
      await this.deleteRelatedData(tableName, recordId);

      // Delete the main record
      const result = await queryWithResult(`DELETE FROM "${tableName}" WHERE id = $1`, [recordId]);

      // Log the action with record metadata
      await this.logAdminAction(deletedBy, 'permanent_delete', tableName, recordId, reason, record);

      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error permanently deleting ${tableName} record ${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Get all soft deleted records from a table
   * @param {string} tableName - Name of the table
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @returns {Promise<object>} - Deleted records with pagination info
   */
  async getDeletedRecords(tableName, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;

      const records = await query(
        `SELECT *, 
         EXTRACT(DAYS FROM (CURRENT_TIMESTAMP - "deletedAt")) as "daysSinceDeleted",
         CASE 
           WHEN EXTRACT(DAYS FROM (CURRENT_TIMESTAMP - "deletedAt")) > 60 THEN true 
           ELSE false 
         END as "cannotRestore"
         FROM "${tableName}" 
         WHERE "deletedAt" IS NOT NULL 
         ORDER BY "deletedAt" DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const totalResult = await queryOne(
        `SELECT COUNT(*) as total FROM "${tableName}" WHERE "deletedAt" IS NOT NULL`
      );

      return {
        records,
        pagination: {
          page,
          limit,
          total: parseInt(totalResult.total),
          pages: Math.ceil(totalResult.total / limit)
        }
      };
    } catch (error) {
      console.error(`Error getting deleted records from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Delete related data when permanently deleting records
   * Handles foreign key relationships
   */
  async deleteRelatedData(tableName, recordId) {
    switch (tableName) {
      case 'post':
        await query('DELETE FROM "like" WHERE "postId" = $1', [recordId]);
        await query('DELETE FROM comment WHERE "postId" = $1', [recordId]);
        await query('DELETE FROM save WHERE "postId" = $1', [recordId]);
        await query('DELETE FROM media WHERE "postId" = $1', [recordId]);
        await query('DELETE FROM notification WHERE "postId" = $1', [recordId]);
        break;
        
      case 'user':
        // Note: This is complex - should soft delete related records instead
        // For now, we'll cascade delete but in production you'd want to soft delete these too
        await query('DELETE FROM post WHERE "authorId" = $1', [recordId]);
        await query('DELETE FROM listing WHERE "authorId" = $1', [recordId]);
        await query('DELETE FROM comment WHERE "authorId" = $1', [recordId]);
        await query('DELETE FROM message WHERE "authorId" = $1 OR "receiverId" = $1', [recordId]);
        await query('DELETE FROM follow WHERE "followerId" = $1 OR "followingId" = $1', [recordId]);
        await query('DELETE FROM "like" WHERE "userId" = $1', [recordId]);
        await query('DELETE FROM save WHERE "userId" = $1', [recordId]);
        await query('DELETE FROM notification WHERE "recipientId" = $1 OR "senderId" = $1', [recordId]);
        await query('DELETE FROM profile WHERE "userId" = $1', [recordId]);
        break;
        
      case 'listing':
        await query('DELETE FROM media WHERE "listingId" = $1', [recordId]);
        await query('DELETE FROM listing_details WHERE "listingId" = $1', [recordId]);
        await query('DELETE FROM conversation WHERE "listingId" = $1', [recordId]);
        break;
        
      case 'comment':
        // Delete child comments recursively
        await query('DELETE FROM "like" WHERE "commentId" = $1', [recordId]);
        await query('DELETE FROM notification WHERE "commentId" = $1', [recordId]);
        break;
        
      case 'conversation':
        await query('DELETE FROM message WHERE "conversationId" = $1', [recordId]);
        break;
    }
  }

  /**
   * Log admin actions for audit trail
   */
  async logAdminAction(adminId, action, targetTable, targetId, reason = null, metadata = null) {
    try {
      await query(
        `INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, metadata, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [adminId, action, targetTable, targetId, reason, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (error) {
      console.error('Error logging admin action:', error);
      // Don't throw here to avoid breaking the main operation
    }
  }

  /**
   * Get admin action logs
   */
  async getAdminActionLogs(page = 1, limit = 50, tableFilter = null, actionFilter = null) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = '';
      const params = [];
      let paramCount = 0;

      if (tableFilter) {
        paramCount++;
        whereClause += `WHERE "targetTable" = $${paramCount}`;
        params.push(tableFilter);
      }

      if (actionFilter) {
        paramCount++;
        whereClause += `${whereClause ? ' AND' : 'WHERE'} action = $${paramCount}`;
        params.push(actionFilter);
      }

      params.push(limit, offset);
      paramCount += 2;

      const logs = await query(
        `SELECT aal.*, u.name as "adminName", u.username as "adminUsername"
         FROM admin_action_log aal
         JOIN "user" u ON aal."adminId" = u.id
         ${whereClause}
         ORDER BY aal."createdAt" DESC
         LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
        params
      );

      return logs;
    } catch (error) {
      console.error('Error getting admin action logs:', error);
      throw error;
    }
  }
}

module.exports = new SoftDeleteService();
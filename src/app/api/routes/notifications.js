const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get notifications for a user
router.get('/getNotifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const notifications = await query(`
      SELECT 
        n.id, n.content, n.type, n."createdAt", n.read,
        n."postId", n."commentId", n."followId", n."messageId",
        s.id as "senderId", s.name as "senderName", s.username as "senderUsername",
        sp."profilePictureUrl" as "senderProfilePicture",
        p.title as "postTitle",
        c.content as "commentContent",
        m.content as "messageContent"
      FROM notification n
      LEFT JOIN "user" s ON n."senderId" = s.id
      LEFT JOIN profile sp ON s.id = sp."userId"
      LEFT JOIN post p ON n."postId" = p.id
      LEFT JOIN comment c ON n."commentId" = c.id
      LEFT JOIN message m ON n."messageId" = m.id
      WHERE n."recipientId" = $1
      ORDER BY n."createdAt" DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // Mark notifications as read when fetched
    if (notifications.length > 0) {
      const notificationIds = notifications.map(n => n.id);
      const placeholders = notificationIds.map((_, index) => `$${index + 1}`).join(',');
      await query(
        `UPDATE notification SET read = true WHERE id IN (${placeholders})`,
        notificationIds
      );
    }

    res.json({
      status: 'success',
      payload: {
        notifications: notifications.map(n => ({
          ...n,
          read: Boolean(n.read)
        })),
        pagination: {
          page,
          limit,
          hasMore: notifications.length === limit
        }
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications'
    });
  }
});

// Get unread notifications count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await queryOne(
      'SELECT COUNT(*) as count FROM notification WHERE "recipientId" = $1 AND read = false',
      [userId]
    );

    res.json({
      status: 'success',
      payload: {
        count: result.count || 0
      }
    });

  } catch (error) {
    console.error('Get unread notifications count error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get unread notifications count'
    });
  }
});

// Mark notification as read
router.post('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.notificationId;
    const userId = req.user.id;

    // Verify notification belongs to user
    const notification = await queryOne(
      'SELECT id FROM notification WHERE id = $1 AND "recipientId" = $2',
      [notificationId, userId]
    );

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    // Mark as read
    await query(
      'UPDATE notification SET read = true WHERE id = $1',
      [notificationId]
    );

    res.json({
      status: 'success',
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await query(
      'UPDATE notification SET read = true WHERE "recipientId" = $1 AND read = false',
      [userId]
    );

    res.json({
      status: 'success',
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark all notifications as read'
    });
  }
});

// Delete a notification
router.post('/:notificationId/delete', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.notificationId;
    const userId = req.user.id;

    // Verify notification belongs to user
    const notification = await queryOne(
      'SELECT id FROM notification WHERE id = $1 AND "recipientId" = $2',
      [notificationId, userId]
    );

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    // Delete notification
    await query('DELETE FROM notification WHERE id = $1', [notificationId]);

    res.json({
      status: 'success',
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete notification'
    });
  }
});

// Delete all notifications for user
router.delete('/clear-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await query('DELETE FROM notification WHERE "recipientId" = $1', [userId]);

    res.json({
      status: 'success',
      message: 'All notifications cleared'
    });

  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear notifications'
    });
  }
});

// Create notification (utility function for internal use)
async function createNotification(type, recipientId, senderId, content, relatedIds = {}) {
  try {
    const { postId, commentId, followId, messageId } = relatedIds;
    
    console.log(`Creating notification: type=${type}, recipientId=${recipientId}, senderId=${senderId}, content=${content}`);
    
    await query(
      'INSERT INTO notification (type, "recipientId", "senderId", content, "postId", "commentId", "followId", "messageId", read, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, CURRENT_TIMESTAMP)',
      [type, recipientId, senderId, content, postId || null, commentId || null, followId || null, messageId || null]
    );
    
    console.log(`Notification created successfully for user ${recipientId}`);
  } catch (error) {
    console.error('Create notification error:', error);
    // Don't throw error to avoid breaking the main operation
  }
}

// Export the create notification function for use in other routes
module.exports = router;
module.exports.createNotification = createNotification;

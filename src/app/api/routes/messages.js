const express = require('express');
const { query, queryOne, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all conversations for the current user
router.get('/conversations/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await query(`
      SELECT 
        c.id, c.user1Id, c.user2Id, c.createdAt, c.updatedAt, c.listingId,
        CASE 
          WHEN c.user1Id = ? THEN u2.id
          ELSE u1.id
        END as otherUserId,
        CASE 
          WHEN c.user1Id = ? THEN u2.name
          ELSE u1.name
        END as otherUserName,
        CASE 
          WHEN c.user1Id = ? THEN u2.username
          ELSE u1.username
        END as otherUserUsername,
        CASE 
          WHEN c.user1Id = ? THEN p2.profilePictureUrl
          ELSE p1.profilePictureUrl
        END as otherUserProfilePicture,
        l.title as listingTitle,
        lm.content as lastMessageContent,
        lm.createdAt as lastMessageTime,
        lm.authorId as lastMessageAuthorId,
        (
          SELECT COUNT(*) 
          FROM message m 
          WHERE m.conversationId = c.id 
            AND m.receiverId = ? 
            AND m.readAt IS NULL
        ) as unreadCount
      FROM conversation c
      LEFT JOIN user u1 ON c.user1Id = u1.id
      LEFT JOIN user u2 ON c.user2Id = u2.id
      LEFT JOIN profile p1 ON u1.id = p1.userId
      LEFT JOIN profile p2 ON u2.id = p2.userId
      LEFT JOIN listing l ON c.listingId = l.id
      LEFT JOIN (
        SELECT 
          m1.conversationId,
          m1.content,
          m1.createdAt,
          m1.authorId
        FROM message m1
        INNER JOIN (
          SELECT conversationId, MAX(createdAt) as maxTime
          FROM message
          GROUP BY conversationId
        ) m2 ON m1.conversationId = m2.conversationId AND m1.createdAt = m2.maxTime
      ) lm ON c.id = lm.conversationId
      WHERE c.user1Id = ? OR c.user2Id = ?
      ORDER BY COALESCE(lm.createdAt, c.createdAt) DESC
    `, [userId, userId, userId, userId, userId, userId, userId]);

    // Transform the data to match frontend expectations
    const transformedConversations = conversations.map(conv => {
      // Construct full image URL if profile picture exists
      let imageProfile = null;
      if (conv.otherUserProfilePicture) {
        // If it's already a full URL, use it as is
        if (conv.otherUserProfilePicture.startsWith('http')) {
          imageProfile = conv.otherUserProfilePicture;
        } else {
          // If it's a relative path, construct the full URL without /api prefix
          // Remove leading slash if present to avoid double slashes
          const cleanPath = conv.otherUserProfilePicture.startsWith('/') 
            ? conv.otherUserProfilePicture.substring(1) 
            : conv.otherUserProfilePicture;
          imageProfile = `${req.protocol}://${req.get('host')}/${cleanPath}`;
        }
      }

      return {
        id: conv.id,
        user1Id: conv.user1Id,
        user2Id: conv.user2Id,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        listingId: conv.listingId,
        otherUser: {
          id: conv.otherUserId,
          name: conv.otherUserName,
          username: conv.otherUserUsername,
          imageProfile: imageProfile,
          profilePictureUrl: imageProfile
        },
        lastMessage: conv.lastMessageContent,
        unreadCount: conv.unreadCount,
        listingTitle: conv.listingTitle
      };
    });

    res.json({
      status: 'success',
      payload: transformedConversations
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch conversations'
    });
  }
});

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const userId = req.user.id;

    // Verify user is part of this conversation
    const conversation = await queryOne(
      'SELECT id FROM conversation WHERE id = ? AND (user1Id = ? OR user2Id = ?)',
      [conversationId, userId, userId]
    );

    if (!conversation) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to this conversation'
      });
    }

    const messages = await query(`
      SELECT 
        m.id, m.content, m.createdAt, m.readAt,
        m.authorId, m.receiverId,
        u.name as authorName, u.username as authorUsername,
        p.profilePictureUrl as authorProfilePicture
      FROM message m
      LEFT JOIN user u ON m.authorId = u.id
      LEFT JOIN profile p ON u.id = p.userId
      WHERE m.conversationId = ?
      ORDER BY m.createdAt ASC
    `, [conversationId]);

    res.json({
      status: 'success',
      payload: messages
    });

  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch messages'
    });
  }
});

// Create a new conversation
router.post('/conversations/create', authenticateToken, async (req, res) => {
  try {
    const { recipientId, listingId } = req.body;
    const user1Id = req.user.id;

    if (user1Id === recipientId) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot create conversation with yourself'
      });
    }

    // Check if conversation already exists
    const existingConversation = await queryOne(`
      SELECT id, user1Id, user2Id, listingId, createdAt, updatedAt FROM conversation 
      WHERE ((user1Id = ? AND user2Id = ?) OR (user1Id = ? AND user2Id = ?))
        ${listingId ? 'AND listingId = ?' : 'AND listingId IS NULL'}
    `, listingId ? 
      [user1Id, recipientId, recipientId, user1Id, listingId] : 
      [user1Id, recipientId, recipientId, user1Id]
    );

    if (existingConversation) {
      // Get the other user's info for the existing conversation
      const otherUserId = existingConversation.user1Id === user1Id ? existingConversation.user2Id : existingConversation.user1Id;
      const otherUser = await queryOne(`
        SELECT u.id, u.name, u.username, p.profilePictureUrl
        FROM user u
        LEFT JOIN profile p ON u.id = p.userId
        WHERE u.id = ?
      `, [otherUserId]);

      let imageProfile = null;
      if (otherUser.profilePictureUrl) {
        const cleanPath = otherUser.profilePictureUrl.startsWith('/') 
          ? otherUser.profilePictureUrl.substring(1) 
          : otherUser.profilePictureUrl;
        imageProfile = `${req.protocol}://${req.get('host')}/${cleanPath}`;
      }

      return res.json({
        status: 'success',
        message: 'Conversation already exists',
        payload: {
          id: existingConversation.id,
          user1Id: existingConversation.user1Id,
          user2Id: existingConversation.user2Id,
          createdAt: existingConversation.createdAt,
          updatedAt: existingConversation.updatedAt,
          listingId: existingConversation.listingId,
          otherUser: {
            id: otherUser.id,
            name: otherUser.name,
            username: otherUser.username,
            imageProfile: imageProfile,
            profilePictureUrl: imageProfile
          }
        }
      });
    }

    // Create new conversation
    const result = await query(
      'INSERT INTO conversation (user1Id, user2Id, listingId, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())',
      [user1Id, recipientId, listingId || null]
    );

    // Get the other user's info for the new conversation
    const otherUser = await queryOne(`
      SELECT u.id, u.name, u.username, p.profilePictureUrl
      FROM user u
      LEFT JOIN profile p ON u.id = p.userId
      WHERE u.id = ?
    `, [recipientId]);

    let imageProfile = null;
    if (otherUser.profilePictureUrl) {
      const cleanPath = otherUser.profilePictureUrl.startsWith('/') 
        ? otherUser.profilePictureUrl.substring(1) 
        : otherUser.profilePictureUrl;
      imageProfile = `${req.protocol}://${req.get('host')}/${cleanPath}`;
    }

    res.status(201).json({
      status: 'success',
      message: 'Conversation created successfully',
      payload: {
        id: result.insertId,
        user1Id: user1Id,
        user2Id: recipientId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        listingId: listingId || null,
        otherUser: {
          id: otherUser.id,
          name: otherUser.name,
          username: otherUser.username,
          imageProfile: imageProfile,
          profilePictureUrl: imageProfile
        }
      }
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create conversation'
    });
  }
});

// Send a message
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { receiverId, content, conversationId } = req.body;
    const senderId = req.user.id;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Message content is required'
      });
    }

    let finalConversationId = conversationId;

    // If no conversationId provided, find or create one
    if (!finalConversationId) {
      const existingConversation = await queryOne(`
        SELECT id FROM conversation 
        WHERE (user1Id = ? AND user2Id = ?) OR (user1Id = ? AND user2Id = ?)
          AND listingId IS NULL
      `, [senderId, receiverId, receiverId, senderId]);

      if (existingConversation) {
        finalConversationId = existingConversation.id;
      } else {
        // Create new conversation
        const newConversation = await query(
          'INSERT INTO conversation (user1Id, user2Id, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())',
          [senderId, receiverId]
        );
        finalConversationId = newConversation.insertId;
      }
    }

    // Verify user is part of the conversation
    const conversation = await queryOne(
      'SELECT id FROM conversation WHERE id = ? AND (user1Id = ? OR user2Id = ?)',
      [finalConversationId, senderId, senderId]
    );

    if (!conversation) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to this conversation'
      });
    }

    // Insert message
    const result = await query(
      'INSERT INTO message (content, conversationId, authorId, receiverId, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [content.trim(), finalConversationId, senderId, receiverId]
    );

    // Update conversation timestamp
    await query(
      'UPDATE conversation SET updatedAt = NOW() WHERE id = ?',
      [finalConversationId]
    );

    // Get the created message with user info
    const message = await queryOne(`
      SELECT 
        m.id, m.content, m.createdAt, m.readAt,
        m.authorId, m.receiverId, m.conversationId,
        u.name as authorName, u.username as authorUsername,
        p.profilePictureUrl as authorProfilePicture
      FROM message m
      LEFT JOIN user u ON m.authorId = u.id
      LEFT JOIN profile p ON u.id = p.userId
      WHERE m.id = ?
    `, [result.insertId]);

    res.status(201).json({
      status: 'success',
      message: 'Message sent successfully',
      payload: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send message'
    });
  }
});

// Mark conversation as read
router.post('/conversations/:conversationId/read', authenticateToken, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const userId = req.user.id;

    // Verify user is part of this conversation
    const conversation = await queryOne(
      'SELECT id FROM conversation WHERE id = ? AND (user1Id = ? OR user2Id = ?)',
      [conversationId, userId, userId]
    );

    if (!conversation) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to this conversation'
      });
    }

    // Mark all unread messages in this conversation as read for this user
    await query(
      'UPDATE message SET readAt = NOW() WHERE conversationId = ? AND receiverId = ? AND readAt IS NULL',
      [conversationId, userId]
    );

    res.json({
      status: 'success',
      message: 'Conversation marked as read'
    });

  } catch (error) {
    console.error('Mark conversation as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark conversation as read'
    });
  }
});

// Get unread messages count
router.get('/unread-count/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Count conversations with unread messages, not individual messages
    const result = await queryOne(`
      SELECT COUNT(DISTINCT conversationId) as count 
      FROM message 
      WHERE receiverId = ? AND readAt IS NULL
    `, [userId]);

    res.json({
      status: 'success',
      payload: {
        count: result.count || 0
      }
    });

  } catch (error) {
    console.error('Get unread messages count error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get unread messages count'
    });
  }
});

// Delete a conversation
router.delete('/conversations/:conversationId', authenticateToken, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const userId = req.user.id;

    // Verify user is part of this conversation
    const conversation = await queryOne(
      'SELECT id FROM conversation WHERE id = ? AND (user1Id = ? OR user2Id = ?)',
      [conversationId, userId, userId]
    );

    if (!conversation) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied to this conversation'
      });
    }

    // Delete conversation (CASCADE will handle messages)
    await query('DELETE FROM conversation WHERE id = ?', [conversationId]);

    res.json({
      status: 'success',
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete conversation'
    });
  }
});

// Delete a message
router.delete('/:messageId', authenticateToken, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.user.id;

    // Check if user owns the message
    const message = await queryOne(
      'SELECT id, authorId FROM message WHERE id = ?',
      [messageId]
    );

    if (!message) {
      return res.status(404).json({
        status: 'error',
        message: 'Message not found'
      });
    }

    if (message.authorId !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized to delete this message'
      });
    }

    // Delete message
    await query('DELETE FROM message WHERE id = ?', [messageId]);

    res.json({
      status: 'success',
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete message'
    });
  }
});

module.exports = router;

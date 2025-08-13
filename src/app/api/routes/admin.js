const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin privileges
const requireAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated and has admin privileges
    // The user object is already available from the authenticateToken middleware
    if (!req.user || (req.user.email !== 'admin@artlink.com' && req.user.username !== 'admin')) {
      return res.status(403).json({
        status: 'error',
        message: 'Admin privileges required'
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error checking admin privileges'
    });
  }
};

// Apply authentication and admin check to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard Statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = {};
    
    // Get total users
    const totalUsersResult = await queryOne('SELECT COUNT(*) as count FROM user');
    stats.totalUsers = totalUsersResult.count;
    
    // Get total posts
    const totalPostsResult = await queryOne('SELECT COUNT(*) as count FROM post WHERE published = 1');
    stats.totalPosts = totalPostsResult.count;
    
    // Get total listings
    const totalListingsResult = await queryOne('SELECT COUNT(*) as count FROM listing WHERE published = 1');
    stats.totalListings = totalListingsResult.count;
    
    // Get total messages
    const totalMessagesResult = await queryOne('SELECT COUNT(*) as count FROM message');
    stats.totalMessages = totalMessagesResult.count;
    
    // Get active users (users who logged in within last 24 hours)
    const activeUsersResult = await queryOne(
      'SELECT COUNT(*) as count FROM user WHERE updatedAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    );
    stats.activeUsers = activeUsersResult.count;
    
    res.json({
      status: 'success',
      payload: stats
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching dashboard statistics'
    });
  }
});

// Recent Activity
router.get('/dashboard/activity', async (req, res) => {
  try {
    const recentActivity = [];
    
    // Get recent user registrations
    const recentUsers = await query(`
      SELECT 'user_registered' as type, u.name as userName, u.createdAt, 
             CONCAT(u.name, ' (@', u.username, ') joined ArtLink') as description
      FROM user u 
      ORDER BY u.createdAt DESC 
      LIMIT 5
    `);
    
    // Get recent posts
    const recentPosts = await query(`
      SELECT 'post_created' as type, u.name as userName, p.createdAt,
             CONCAT(u.name, ' created a new post: "', SUBSTRING(p.title, 1, 50), '"') as description
      FROM post p 
      JOIN user u ON p.authorId = u.id 
      WHERE p.published = 1
      ORDER BY p.createdAt DESC 
      LIMIT 5
    `);
    
    // Get recent listings
    const recentListings = await query(`
      SELECT 'listing_created' as type, u.name as userName, l.createdAt,
             CONCAT(u.name, ' created a new listing: "', SUBSTRING(l.title, 1, 50), '"') as description
      FROM listing l 
      JOIN user u ON l.authorId = u.id 
      WHERE l.published = 1
      ORDER BY l.createdAt DESC 
      LIMIT 5
    `);
    
    // Combine and sort all activities
    const allActivities = [...recentUsers, ...recentPosts, ...recentListings];
    const sortedActivities = allActivities
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);
    
    res.json({
      status: 'success',
      payload: sortedActivities
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching recent activity'
    });
  }
});

// User Management
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let params = [];
    
    if (search) {
      whereClause = 'WHERE u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?';
      params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    
    // Get users with additional info
    const users = await query(`
      SELECT 
        u.id, u.name, u.username, u.email, u.createdAt, u.updatedAt,
        p.profilePictureUrl,
        COUNT(DISTINCT po.id) as postsCount,
        COUNT(DISTINCT f.id) as followersCount,
        CASE WHEN u.id IS NOT NULL THEN true ELSE false END as isActive
      FROM user u
      LEFT JOIN profile p ON u.id = p.userId
      LEFT JOIN post po ON u.id = po.authorId AND po.published = 1
      LEFT JOIN follow f ON u.id = f.followingId
      ${whereClause}
      GROUP BY u.id, u.name, u.username, u.email, u.createdAt, u.updatedAt, p.profilePictureUrl
      ORDER BY u.createdAt DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    // Get total count
    const totalResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM user u 
      ${whereClause}
    `, params);
    
    // Format the response
    const formattedUsers = users.map(user => ({
      ...user,
      lastLogin: user.updatedAt, // Using updatedAt as lastLogin proxy
      profileImage: user.profilePictureUrl
    }));
    
    res.json({
      status: 'success',
      payload: {
        users: formattedUsers,
        total: totalResult.total,
        page,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching users'
    });
  }
});

// Get specific user
router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await queryOne(`
      SELECT 
        u.id, u.name, u.username, u.email, u.createdAt, u.updatedAt,
        p.profilePictureUrl, p.bio,
        COUNT(DISTINCT po.id) as postsCount,
        COUNT(DISTINCT f.id) as followersCount,
        COUNT(DISTINCT f2.id) as followingCount
      FROM user u
      LEFT JOIN profile p ON u.id = p.userId
      LEFT JOIN post po ON u.id = po.authorId AND po.published = 1
      LEFT JOIN follow f ON u.id = f.followingId
      LEFT JOIN follow f2 ON u.id = f2.followerId
      WHERE u.id = ?
      GROUP BY u.id, u.name, u.username, u.email, u.createdAt, u.updatedAt, p.profilePictureUrl, p.bio
    `, [userId]);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    res.json({
      status: 'success',
      payload: {
        ...user,
        lastLogin: user.updatedAt,
        profileImage: user.profilePictureUrl,
        isActive: true // Add logic for suspended users if needed
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user details'
    });
  }
});

// Post Management
router.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = req.query.filter || 'all';
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    if (filter === 'published') {
      whereClause += ' AND p.published = 1';
    } else if (filter === 'hidden') {
      whereClause += ' AND p.published = 0';
    }
    
    const posts = await query(`
      SELECT 
        p.id, p.title, p.content, p.published, p.createdAt, p.updatedAt,
        u.name as authorName, u.username as authorUsername,
        COUNT(DISTINCT l.id) as likesCount,
        COUNT(DISTINCT c.id) as commentsCount
      FROM post p
      JOIN user u ON p.authorId = u.id
      LEFT JOIN \`like\` l ON p.id = l.postId
      LEFT JOIN comment c ON p.id = c.postId
      ${whereClause}
      GROUP BY p.id, p.title, p.content, p.published, p.createdAt, p.updatedAt, 
               u.name, u.username
      ORDER BY p.createdAt DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    // Get media files for each post
    for (let post of posts) {
      const media = await query('SELECT mediaUrl, mediaType FROM media WHERE postId = ?', [post.id]);
      post.media = media;
      // For backward compatibility, set the first media as mediaUrl
      post.mediaUrl = media.length > 0 ? media[0].mediaUrl : null;
    }
    
    const totalResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM post p 
      ${whereClause}
    `);
    
    res.json({
      status: 'success',
      payload: {
        posts,
        total: totalResult.total,
        page,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching posts'
    });
  }
});

// Delete post
router.delete('/posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const { reason } = req.body;
    
    // Check if post exists
    const post = await queryOne('SELECT * FROM post WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }
    
    // Delete related data first (due to foreign key constraints)
    await query('DELETE FROM `like` WHERE postId = ?', [postId]);
    await query('DELETE FROM comment WHERE postId = ?', [postId]);
    await query('DELETE FROM save WHERE postId = ?', [postId]);
    await query('DELETE FROM media WHERE postId = ?', [postId]);
    await query('DELETE FROM notification WHERE postId = ?', [postId]);
    
    // Delete the post
    await query('DELETE FROM post WHERE id = ?', [postId]);
    
    // Log admin action (you might want to create an admin_actions table)
    console.log(`Admin deleted post ${postId}. Reason: ${reason}`);
    
    res.json({
      status: 'success',
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting post'
    });
  }
});

// Hide/Unhide post
router.post('/posts/:id/hide', async (req, res) => {
  try {
    const postId = req.params.id;
    const { reason } = req.body;
    
    await query('UPDATE post SET published = 0 WHERE id = ?', [postId]);
    
    console.log(`Admin hid post ${postId}. Reason: ${reason}`);
    
    res.json({
      status: 'success',
      message: 'Post hidden successfully'
    });
  } catch (error) {
    console.error('Error hiding post:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error hiding post'
    });
  }
});

router.post('/posts/:id/unhide', async (req, res) => {
  try {
    const postId = req.params.id;
    
    await query('UPDATE post SET published = 1 WHERE id = ?', [postId]);
    
    console.log(`Admin unhid post ${postId}`);
    
    res.json({
      status: 'success',
      message: 'Post unhidden successfully'
    });
  } catch (error) {
    console.error('Error unhiding post:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error unhiding post'
    });
  }
});

// User Growth Stats
router.get('/reports/users', async (req, res) => {
  try {
    const period = req.query.period || '30days';
    let days = 30;
    
    if (period === '7days') days = 7;
    else if (period === '90days') days = 90;
    
    const growthData = await query(`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as users
      FROM user 
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `, [days]);
    
    const labels = growthData.map(item => item.date);
    const values = growthData.map(item => item.users);
    
    res.json({
      status: 'success',
      payload: {
        labels,
        values
      }
    });
  } catch (error) {
    console.error('Error fetching user growth stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user growth statistics'
    });
  }
});

// Content Stats
router.get('/reports/content', async (req, res) => {
  try {
    const postsCount = await queryOne('SELECT COUNT(*) as count FROM post WHERE published = 1');
    const listingsCount = await queryOne('SELECT COUNT(*) as count FROM listing WHERE published = 1');
    const commentsCount = await queryOne('SELECT COUNT(*) as count FROM comment');
    
    res.json({
      status: 'success',
      payload: {
        posts: postsCount.count,
        listings: listingsCount.count,
        comments: commentsCount.count
      }
    });
  } catch (error) {
    console.error('Error fetching content stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching content statistics'
    });
  }
});

// Admin Notifications (system notifications for admin)
router.get('/notifications', async (req, res) => {
  try {
    // For now, return recent system activities as notifications
    const notifications = await query(`
      SELECT 
        n.id, n.content, n.type, n.createdAt, n.read,
        'System' as senderName
      FROM notification n
      WHERE n.recipientId = 1 OR n.type IN ('FOLLOW', 'LIKE', 'COMMENT')
      ORDER BY n.createdAt DESC
      LIMIT 20
    `);
    
    res.json({
      status: 'success',
      payload: notifications
    });
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching notifications'
    });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    await query('UPDATE notification SET `read` = 1 WHERE id = ?', [notificationId]);
    
    res.json({
      status: 'success',
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error marking notification as read'
    });
  }
});

// Listings Management
router.get('/listings', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'all';

    let whereClause = '';
    let queryParams = [];

    if (status !== 'all') {
      whereClause = 'WHERE published = ?';
      queryParams.push(status === 'active' ? 1 : 0);
    }

    // Get listings with user info and listing details
    const listings = await query(`
      SELECT l.*, u.username, u.email,
        ld.price, ld.category, ld.condition, ld.location,
        (SELECT COUNT(*) FROM media WHERE listingId = l.id) as image_count,
        (SELECT mediaUrl FROM media WHERE listingId = l.id LIMIT 1) as image_url
      FROM listing l
      LEFT JOIN user u ON l.authorId = u.id
      LEFT JOIN listing_details ld ON l.id = ld.listingId
      ${whereClause}
      ORDER BY l.createdAt DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    // Get total count
    const totalResult = await queryOne(`
      SELECT COUNT(*) as total FROM listing l
      ${whereClause}
    `, queryParams);

    res.json({
      status: 'success',
      data: {
        listings,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalResult.total / limit),
          totalItems: totalResult.total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching listings'
    });
  }
});

// Delete listing
router.delete('/listings/:id', async (req, res) => {
  try {
    const listingId = req.params.id;
    
    // Delete listing media first
    await query('DELETE FROM media WHERE listingId = ?', [listingId]);
    
    // Delete the listing
    await query('DELETE FROM listing WHERE id = ?', [listingId]);
    
    res.json({
      status: 'success',
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting listing'
    });
  }
});

// Messages Management
router.get('/messages', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get messages with sender and receiver info
    const messages = await query(`
      SELECT m.*, 
        s.username as sender_username, s.email as sender_email,
        r.username as receiver_username, r.email as receiver_email
      FROM message m
      LEFT JOIN user s ON m.authorId = s.id
      LEFT JOIN user r ON m.receiverId = r.id
      ORDER BY m.createdAt DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    // Get total count
    const totalResult = await queryOne('SELECT COUNT(*) as total FROM message');

    res.json({
      status: 'success',
      data: {
        messages,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalResult.total / limit),
          totalItems: totalResult.total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching messages'
    });
  }
});

// Delete message
router.delete('/messages/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    
    await query('DELETE FROM message WHERE id = ?', [messageId]);
    
    res.json({
      status: 'success',
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting message'
    });
  }
});

// Reports Overview
router.get('/reports', async (req, res) => {
  try {
    const start = req.query.start;
    const end = req.query.end;
    
    // Basic reports data
    const reports = {
      overview: {
        totalUsers: 0,
        totalPosts: 0,
        totalListings: 0,
        totalMessages: 0
      },
      period: {
        start: start,
        end: end
      }
    };

    // Get counts for the specified period if provided
    let dateFilter = '';
    let dateParams = [];
    
    if (start && end) {
      dateFilter = 'WHERE DATE(createdAt) >= ? AND DATE(createdAt) <= ?';
      dateParams = [start, end];
    }

    // Get user count
    const userCount = await queryOne(`SELECT COUNT(*) as count FROM user ${dateFilter}`, dateParams);
    reports.overview.totalUsers = userCount.count;

    // Get post count
    const postCount = await queryOne(`SELECT COUNT(*) as count FROM post ${dateFilter}`, dateParams);
    reports.overview.totalPosts = postCount.count;

    // Get listing count
    const listingCount = await queryOne(`SELECT COUNT(*) as count FROM listing ${dateFilter}`, dateParams);
    reports.overview.totalListings = listingCount.count;

    // Get message count
    const messageCount = await queryOne(`SELECT COUNT(*) as count FROM message ${dateFilter}`, dateParams);
    reports.overview.totalMessages = messageCount.count;

    res.json({
      status: 'success',
      data: reports
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching reports'
    });
  }
});

// Admin Settings
router.get('/settings', async (req, res) => {
  try {
    // For now, return basic settings structure
    // In a real app, you'd store these in a settings table
    const settings = {
      general: {
        siteName: 'ArtLink',
        siteDescription: 'Connect, Create, Collaborate',
        maintenanceMode: false,
        registrationEnabled: true
      },
      content: {
        maxFileSize: '10MB',
        allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif'],
        autoModeration: false,
        requireApproval: false
      },
      security: {
        twoFactorEnabled: false,
        passwordMinLength: 8,
        sessionTimeout: 30,
        maxLoginAttempts: 5
      },
      notifications: {
        emailNotifications: true,
        pushNotifications: false,
        adminAlerts: true
      }
    };

    res.json({
      status: 'success',
      data: settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching settings'
    });
  }
});

// Update settings
router.put('/settings', async (req, res) => {
  try {
    const settings = req.body;
    
    // In a real app, you'd save these to a database
    // For now, just return success
    
    res.json({
      status: 'success',
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating settings'
    });
  }
});

module.exports = router;

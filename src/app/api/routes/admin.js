const express = require('express');
const { query, queryOne } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const softDeleteService = require('../services/soft-delete.service');
const emailService = require('../services/email.service');
const { createNotification } = require('./notifications');

const router = express.Router();

// Add specific CORS handling for admin routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control');
  

// Suspend user (account-level restriction)
router.post('/users/:userId/suspend', async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user?.id || null;
    const { reason = 'Account suspended due to policy violation' } = req.body || {};

    const user = await queryOne('SELECT id FROM "user" WHERE id = $1', [userId]);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    const ins = await query(
      `INSERT INTO user_restriction ("userId", type, reason, "adminId", metadata, "expiresAt")
       VALUES ($1, 'account', $2, $3, $4, NULL)
       RETURNING id`,
      [userId, reason, adminId, JSON.stringify({ source: 'admin_panel' })]
    );

    await softDeleteService.logAdminAction(adminId, 'suspend_user', 'user', Number(userId), reason);

    return res.json({ status: 'success', message: 'User suspended', payload: ins.rows?.[0] || null });
  } catch (error) {
    console.error('Error suspending user:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to suspend user' });
  }
});

// Unsuspend user (remove active account restriction)
router.post('/users/:userId/unsuspend', async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user?.id || null;

    await query(
      `UPDATE user_restriction SET "expiresAt" = CURRENT_TIMESTAMP
       WHERE "userId" = $1 AND type = 'account' AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP)`,
      [userId]
    );

    await softDeleteService.logAdminAction(adminId, 'unsuspend_user', 'user', Number(userId), 'Lifted account suspension');

    return res.json({ status: 'success', message: 'User unsuspended' });
  } catch (error) {
    console.error('Error unsuspending user:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to unsuspend user' });
  }
});
  // Handle preflight requests for admin routes
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware to check admin privileges
const requireAdmin = async (req, res, next) => {
  try {
    console.log('🔍 Admin middleware - checking privileges for user:', req.user?.email || req.user?.username);
    
    // Check if user is authenticated and has admin privileges
    if (!req.user || (req.user.email !== 'admin@artlink.com' && req.user.username !== 'admin')) {
      console.log('🔍 Admin access denied for user:', req.user?.email || req.user?.username);
      return res.status(403).json({
        status: 'error',
        message: 'Admin privileges required'
      });
    }
    
    console.log('🔍 Admin access granted for user:', req.user.email || req.user.username);
    next();
  } catch (error) {
    console.error('🔍 Admin middleware error:', error);
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
    console.log('🔍 Fetching admin dashboard stats...');
    const stats = {};
    
    // Get total users
    const totalUsersResult = await queryOne('SELECT COUNT(*) as count FROM "user"');
    stats.totalUsers = parseInt(totalUsersResult.count) || 0;
    
    // Get total posts
    const totalPostsResult = await queryOne('SELECT COUNT(*) as count FROM post WHERE published = true');
    stats.totalPosts = parseInt(totalPostsResult.count) || 0;
    
    // Get total listings
    const totalListingsResult = await queryOne('SELECT COUNT(*) as count FROM listing WHERE published = true');
    stats.totalListings = parseInt(totalListingsResult.count) || 0;
    
    // Get total messages
    const totalMessagesResult = await queryOne('SELECT COUNT(*) as count FROM message');
    stats.totalMessages = totalMessagesResult.count;
    
    // Get active users (users who logged in within last 24 hours)
    const activeUsersResult = await queryOne(
      'SELECT COUNT(*) as count FROM "user" WHERE "updatedAt" >= CURRENT_TIMESTAMP - INTERVAL \'24 hours\''
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
      SELECT 'user_registered' as type, u.name as "userName", u."createdAt", 
             CONCAT(u.name, ' (@', u.username, ') joined ArtLink') as description
      FROM "user" u 
      ORDER BY u."createdAt" DESC 
      LIMIT 5
    `);
    
    // Get recent posts
    const recentPosts = await query(`
      SELECT 'post_created' as type, u.name as "userName", p."createdAt",
             CONCAT(u.name, ' created a new post: "', SUBSTRING(p.title, 1, 50), '"') as description
      FROM post p 
      JOIN "user" u ON p."authorId" = u.id 
      WHERE p.published = true
      ORDER BY p."createdAt" DESC 
      LIMIT 5
    `);
    
    // Get recent listings
    const recentListings = await query(`
      SELECT 'listing_created' as type, u.name as "userName", l."createdAt",
             CONCAT(u.name, ' created a new listing: "', SUBSTRING(l.title, 1, 50), '"') as description
      FROM listing l 
      JOIN "user" u ON l."authorId" = u.id 
      WHERE l.published = true
      ORDER BY l."createdAt" DESC 
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
    
    let whereClause = 'WHERE u."deletedAt" IS NULL'; // Only show non-deleted users
    let params = [];
    
    if (search) {
      whereClause = 'WHERE u."deletedAt" IS NULL AND (u.name ILIKE $1 OR u.username ILIKE $2 OR u.email ILIKE $3)';
      params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    
    // Get users with additional info
    const users = await query(`
      SELECT 
        u.id, u.name, u.username, u.email, u."createdAt", u."updatedAt",
        p."profilePictureUrl",
        COUNT(DISTINCT po.id) as "postsCount",
        COUNT(DISTINCT f.id) as "followersCount",
        CASE WHEN u.id IS NOT NULL THEN true ELSE false END as "isActive"
      FROM "user" u
      LEFT JOIN profile p ON u.id = p."userId"
      LEFT JOIN post po ON u.id = po."authorId" AND po.published = true
      LEFT JOIN follow f ON u.id = f."followingId"
      ${whereClause}
      GROUP BY u.id, u.name, u.username, u.email, u."createdAt", u."updatedAt", p."profilePictureUrl"
      ORDER BY u."createdAt" DESC
      LIMIT $${search ? 4 : 1} OFFSET $${search ? 5 : 2}
    `, search ? [...params, limit, offset] : [limit, offset]);
    
    // Get total count
    const totalResult = await queryOne(`
      SELECT COUNT(*) as total 
      FROM "user" u 
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
        u.id, u.name, u.username, u.email, u."createdAt", u."updatedAt",
        p."profilePictureUrl", p.bio,
        COUNT(DISTINCT po.id) as "postsCount",
        COUNT(DISTINCT f.id) as "followersCount",
        COUNT(DISTINCT f2.id) as "followingCount"
      FROM "user" u
      LEFT JOIN profile p ON u.id = p."userId"
      LEFT JOIN post po ON u.id = po."authorId" AND po.published = true
      LEFT JOIN follow f ON u.id = f."followingId"
      LEFT JOIN follow f2 ON u.id = f2."followerId"
      WHERE u.id = $1 AND u."deletedAt" IS NULL
      GROUP BY u.id, u.name, u.username, u.email, u."createdAt", u."updatedAt", p."profilePictureUrl", p.bio
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
    
    let whereClause = 'WHERE p."deletedAt" IS NULL'; // Only show non-deleted posts
    if (filter === 'published') {
      whereClause += ' AND p.published = true';
    } else if (filter === 'hidden') {
      whereClause += ' AND p.published = false';
    }
    
    const posts = await query(`
      SELECT 
        p.id, p.title, p.content, p.published, p."createdAt", p."updatedAt",
        u.name as "authorName", u.username as "authorUsername",
        COUNT(DISTINCT l.id) as "likesCount",
        COUNT(DISTINCT c.id) as "commentsCount"
      FROM post p
      JOIN "user" u ON p."authorId" = u.id
      LEFT JOIN "like" l ON p.id = l."postId"
      LEFT JOIN comment c ON p.id = c."postId"
      ${whereClause}
      GROUP BY p.id, p.title, p.content, p.published, p."createdAt", p."updatedAt", 
               u.name, u.username
      ORDER BY p."createdAt" DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    // Get media files for each post
    for (let post of posts) {
      const media = await query('SELECT "mediaUrl", "mediaType" FROM media WHERE "postId" = $1', [post.id]);
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

// Delete post (Soft Delete)
router.delete('/posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    // Check if post exists and is not already deleted
    const post = await queryOne('SELECT * FROM post WHERE id = $1 AND "deletedAt" IS NULL', [postId]);
    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found or already deleted'
      });
    }
    
    // Perform soft delete
    await softDeleteService.softDelete('post', postId, adminId, reason);
    
    res.json({
      status: 'success',
      message: 'Post soft deleted successfully'
    });
  } catch (error) {
    console.error('Error soft deleting post:', error);
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
    
    await query('UPDATE post SET published = false WHERE id = $1', [postId]);
    
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
    
    await query('UPDATE post SET published = true WHERE id = $1', [postId]);
    
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
    else if (period === '90days' || period === '3months') days = 90;
    else if (period === '6months') days = 180;
    else if (period === '1year') days = 365;

    // Build continuous series and include both daily new users and cumulative total users
    const growthData = await query(`
      WITH series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${days} days' + INTERVAL '1 day',
          CURRENT_DATE,
          INTERVAL '1 day'
        ) AS day
      ), daily AS (
        SELECT DATE("createdAt") AS day, COUNT(*) AS new_users
        FROM "user"
        WHERE "createdAt" >= CURRENT_DATE - INTERVAL '${days} days'
          AND "createdAt" <= CURRENT_DATE + INTERVAL '1 day'
        GROUP BY DATE("createdAt")
      )
      SELECT s.day AS date,
             COALESCE(d.new_users, 0) AS "newUsers",
             (
               SELECT COUNT(*) FROM "user" u2 WHERE DATE(u2."createdAt") <= s.day
             ) AS "totalUsers"
      FROM series s
      LEFT JOIN daily d ON d.day = s.day
      ORDER BY s.day ASC;
    `);

    const labels = growthData.map(item => item.date);
    const newUsers = growthData.map(item => parseInt(item.newUsers));
    const totalUsers = growthData.map(item => parseInt(item.totalUsers));

    res.json({
      status: 'success',
      payload: { labels, newUsers, totalUsers }
    });
  } catch (error) {
    console.error('Error fetching user growth stats:', error);
    res.status(500).json({ status: 'error', message: 'Error fetching user growth statistics' });
  }
});

// Content Stats
router.get('/reports/content', async (req, res) => {
  try {
    const postsCount = await queryOne('SELECT COUNT(*) as count FROM post WHERE published = true');
    const listingsCount = await queryOne('SELECT COUNT(*) as count FROM listing WHERE published = true');
    const commentsCount = await queryOne('SELECT COUNT(*) as count FROM comment');
    
    res.json({
      status: 'success',
      payload: {
        posts: parseInt(postsCount.count) || 0,
        listings: parseInt(listingsCount.count) || 0,
        comments: parseInt(commentsCount.count) || 0
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
    // Return a simple response for now - can be enhanced later
    const notifications = [];
    
    // You can add actual system notifications here when needed
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
    
    await query('UPDATE notification SET read = true WHERE id = $1', [notificationId]);
    
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
      whereClause = 'WHERE published = $1';
      queryParams.push(status === 'active' ? true : false);
    }

    // Get listings with user info and listing details
    const listings = await query(`
      SELECT l.*, u.username, u.email,
        ld.price, ld.category, ld.condition, ld.location,
        (SELECT COUNT(*) FROM media WHERE "listingId" = l.id) as "image_count",
        (SELECT "mediaUrl" FROM media WHERE "listingId" = l.id LIMIT 1) as "image_url"
      FROM listing l
      LEFT JOIN "user" u ON l."authorId" = u.id
      LEFT JOIN listing_details ld ON l.id = ld."listingId"
      ${whereClause}
      ORDER BY l."createdAt" DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
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
    const { reason } = req.body;
    const adminId = req.user.id;
    
    // Check if listing exists and is not already deleted
    const listing = await queryOne('SELECT * FROM listing WHERE id = $1 AND "deletedAt" IS NULL', [listingId]);
    if (!listing) {
      return res.status(404).json({
        status: 'error',
        message: 'Listing not found or already deleted'
      });
    }
    
    // Perform soft delete
    await softDeleteService.softDelete('listing', listingId, adminId, reason);
    
    res.json({
      status: 'success',
      message: 'Listing soft deleted successfully'
    });
  } catch (error) {
    console.error('Error soft deleting listing:', error);
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
        s.username as "sender_username", s.email as "sender_email",
        r.username as "receiver_username", r.email as "receiver_email"
      FROM message m
      LEFT JOIN "user" s ON m."authorId" = s.id
      LEFT JOIN "user" r ON m."receiverId" = r.id
      ORDER BY m."createdAt" DESC
      LIMIT $1 OFFSET $2
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

// Delete message (Soft Delete)
router.delete('/messages/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    // Check if message exists and is not already deleted
    const message = await queryOne('SELECT * FROM message WHERE id = $1 AND "deletedAt" IS NULL', [messageId]);
    if (!message) {
      return res.status(404).json({
        status: 'error',
        message: 'Message not found or already deleted'
      });
    }
    
    // Perform soft delete
    await softDeleteService.softDelete('message', messageId, adminId, reason);
    
    res.json({
      status: 'success',
      message: 'Message soft deleted successfully'
    });
  } catch (error) {
    console.error('Error soft deleting message:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting message'
    });
  }
});

// Reports Overview - handler reused by multiple routes
const getReportsOverviewHandler = async (req, res) => {
  try {
    const start = req.query.start;
    const end = req.query.end;
    const hasRange = Boolean(start && end);
    const formatDate = (d) => d.toISOString().slice(0, 10);
    let prevStart = null, prevEnd = null;
    if (hasRange) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const msPerDay = 24 * 60 * 60 * 1000;
      const spanDays = Math.max(1, Math.round((endDate - startDate) / msPerDay) + 1);
      const prevEndDate = new Date(startDate.getTime() - msPerDay);
      const prevStartDate = new Date(prevEndDate.getTime() - (spanDays - 1) * msPerDay);
      prevStart = formatDate(prevStartDate);
      prevEnd = formatDate(prevEndDate);
    }
    
    // Basic reports data
    const reports = {
      overview: {
        // in-period counts (if range provided) for growth comparisons
        totalUsers: 0,
        previousTotalUsers: 0,
        totalPosts: 0,
        previousTotalPosts: 0,
        totalListings: 0,
        previousTotalListings: 0,
        totalMessages: 0,
        // all-time totals for headline cards
        totalUsersAllTime: 0,
        totalPostsAllTime: 0,
        totalListingsAllTime: 0,
        totalMessagesAllTime: 0,
        activeUsers: 0
      },
      period: {
        start: start,
        end: end,
        previousStart: prevStart,
        previousEnd: prevEnd
      }
    };

    // In-period counts (new items within date range)
    let dateFilter = '';
    let dateParams = [];
    
    if (hasRange) {
      dateFilter = 'WHERE DATE("createdAt") >= $1 AND DATE("createdAt") <= $2';
      dateParams = [start, end];
    }

    // New counts in the current period (if range), else zero
    if (hasRange) {
      const userCount = await queryOne(`SELECT COUNT(*) as count FROM "user" ${dateFilter}`, dateParams);
      reports.overview.totalUsers = parseInt(userCount.count) || 0;
      const postCount = await queryOne(`SELECT COUNT(*) as count FROM post ${dateFilter}`, dateParams);
      reports.overview.totalPosts = parseInt(postCount.count) || 0;
      const listingCount = await queryOne(`SELECT COUNT(*) as count FROM listing ${dateFilter}`, dateParams);
      reports.overview.totalListings = parseInt(listingCount.count) || 0;
      const messageCount = await queryOne(`SELECT COUNT(*) as count FROM message ${dateFilter}`, dateParams);
      reports.overview.totalMessages = parseInt(messageCount.count) || 0;
    }

    // Previous period counts for growth
    if (hasRange && prevStart && prevEnd) {
      const prevFilter = 'WHERE DATE("createdAt") >= $1 AND DATE("createdAt") <= $2';
      const prevParams = [prevStart, prevEnd];
      const prevUsers = await queryOne(`SELECT COUNT(*) as count FROM "user" ${prevFilter}`, prevParams);
      reports.overview.previousTotalUsers = parseInt(prevUsers.count) || 0;
      const prevPosts = await queryOne(`SELECT COUNT(*) as count FROM post ${prevFilter}`, prevParams);
      reports.overview.previousTotalPosts = parseInt(prevPosts.count) || 0;
      const prevListings = await queryOne(`SELECT COUNT(*) as count FROM listing ${prevFilter}`, prevParams);
      reports.overview.previousTotalListings = parseInt(prevListings.count) || 0;
    }

    // All-time headline totals
    const allUsers = await queryOne('SELECT COUNT(*) as count FROM "user" WHERE "deletedAt" IS NULL');
    reports.overview.totalUsersAllTime = parseInt(allUsers.count) || 0;
    const allPosts = await queryOne('SELECT COUNT(*) as count FROM post WHERE published = true');
    reports.overview.totalPostsAllTime = parseInt(allPosts.count) || 0;
    const allListings = await queryOne('SELECT COUNT(*) as count FROM listing WHERE published = true');
    reports.overview.totalListingsAllTime = parseInt(allListings.count) || 0;
    const allMessages = await queryOne('SELECT COUNT(*) as count FROM message');
    reports.overview.totalMessagesAllTime = parseInt(allMessages.count) || 0;
    const activeUsers = await queryOne(`SELECT COUNT(*) as count FROM "user" WHERE "updatedAt" >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`);
    reports.overview.activeUsers = parseInt(activeUsers.count) || 0;

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
};

// Primary endpoint
router.get('/reports/overview', getReportsOverviewHandler);
// Backward-compatible alias expected by frontend
router.get('/reports', getReportsOverviewHandler);

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

// Get all reports for management
router.get('/reports/list', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    console.log('🔍 Fetching reports with filters:', { status, page, limit });

    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      whereClause = `WHERE r.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Get reports with post and user information
    const reports = await query(`
      SELECT 
        r.id,
        r."postId",
        r."reporterId",
        r.reason,
        r.description,
        r.status,
        r."createdAt",
        r."updatedAt",
        p.title as "postTitle",
        p.content as "postContent",
        p."authorId" as "postAuthorId",
        pa.name as "postAuthorName",
        pa.username as "postAuthorUsername",
        rp.name as "reporterName",
        rp.username as "reporterUsername"
      FROM report r
      LEFT JOIN post p ON r."postId" = p.id
      LEFT JOIN "user" pa ON p."authorId" = pa.id
      LEFT JOIN "user" rp ON r."reporterId" = rp.id
      ${whereClause}
      ORDER BY r."createdAt" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset]);

    // Get total count for pagination
    const countResult = await queryOne(`
      SELECT COUNT(*) as total
      FROM report r
      ${whereClause}
    `, queryParams);

    const totalReports = parseInt(countResult.total) || 0;
    const totalPages = Math.ceil(totalReports / limit);

    res.json({
      status: 'success',
      payload: {
        reports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalReports,
          totalPages
        }
      }
    });

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching reports'
    });
  }
});

// Update report status
router.patch('/reports/:reportId/status', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, adminNote } = req.body;

    console.log('🔍 Updating report status:', { reportId, status, adminNote });

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Check if report exists
    const report = await queryOne('SELECT id, "postId" FROM report WHERE id = $1', [reportId]);
    if (!report) {
      return res.status(404).json({
        status: 'error',
        message: 'Report not found'
      });
    }

    // Update the report
    await query(
      'UPDATE report SET status = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
      [status, reportId]
    );

    // If status is 'approved', we might want to hide/remove the post
    // For now, we'll just update the report status
    
    console.log('✅ Report status updated successfully');

    res.json({
      status: 'success',
      message: 'Report status updated successfully'
    });

  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating report status'
    });
  }
});

// Delete a report
router.delete('/reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;

    console.log('🔍 Deleting report:', reportId);

    // Check if report exists
    const report = await queryOne('SELECT id FROM report WHERE id = $1', [reportId]);
    if (!report) {
      return res.status(404).json({
        status: 'error',
        message: 'Report not found'
      });
    }

    // Delete the report
    await query('DELETE FROM report WHERE id = $1', [reportId]);

    console.log('✅ Report deleted successfully');

    res.json({
      status: 'success',
      message: 'Report deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting report'
    });
  }
});

// Get report statistics
router.get('/reports/stats', async (req, res) => {
  try {
    console.log('🔍 Fetching report statistics...');

    // Get total reports
    const totalReportsResult = await queryOne('SELECT COUNT(*) as count FROM report');
    const totalReports = parseInt(totalReportsResult.count) || 0;

    // Get reports by status
    const statusStats = await query(`
      SELECT status, COUNT(*) as count
      FROM report
      GROUP BY status
    `);

    // Get recent reports (last 24 hours)
    const recentReportsResult = await queryOne(`
      SELECT COUNT(*) as count
      FROM report
      WHERE "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `);
    const recentReports = parseInt(recentReportsResult.count) || 0;

    // Get most reported reasons
    const reasonStats = await query(`
      SELECT reason, COUNT(*) as count
      FROM report
      GROUP BY reason
      ORDER BY count DESC
      LIMIT 5
    `);

    res.json({
      status: 'success',
      payload: {
        totalReports,
        recentReports,
        statusBreakdown: statusStats,
        topReasons: reasonStats
      }
    });

  } catch (error) {
    console.error('Error fetching report statistics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching report statistics'
    });
  }
});

/**
 * === MESSAGE REPORT MANAGEMENT (Admins) ===
 * Only exposes messages that were explicitly reported. No browsing of private conversations.
 */

// List message reports
router.get('/message-reports/list', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];
    let idx = 1;
    if (status && status !== 'all') {
      whereClause = `WHERE mr.status = $${idx}`;
      params.push(status);
      idx++;
    }

    const reports = await query(`
      SELECT 
        mr.id,
        mr."messageId",
        mr."conversationId",
        mr."reporterId",
        mr.reason,
        mr.description,
        mr.status,
        mr."createdAt",
        m.content as "messageContent",
        m."authorId" as "messageAuthorId",
        ru.name as "reporterName",
        ru.username as "reporterUsername",
        au.name as "authorName",
        au.username as "authorUsername"
      FROM message_report mr
      LEFT JOIN message m ON mr."messageId" = m.id
      LEFT JOIN "user" ru ON mr."reporterId" = ru.id
      LEFT JOIN "user" au ON m."authorId" = au.id
      ${whereClause}
      ORDER BY mr."createdAt" DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    const countRow = await queryOne(`
      SELECT COUNT(*)::int AS total
      FROM message_report mr
      ${whereClause}
    `, params);

    const total = countRow.total || 0;
    const totalPages = Math.ceil(total / limit);

    return res.json({
      status: 'success',
      payload: {
        reports,
        pagination: { page: Number(page), limit: Number(limit), total, totalPages }
      }
    });
  } catch (error) {
    console.error('Error fetching message reports:', error);
    return res.status(500).json({ status: 'error', message: 'Error fetching message reports' });
  }
});

// Update message report status
router.patch('/message-reports/:reportId/status', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, adminNote } = req.body;
    const adminId = req.user?.id || null; // rely on upstream auth middleware

    const validStatuses = ['pending', 'actioned', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status' });
    }

    const existing = await queryOne('SELECT id FROM message_report WHERE id = $1', [reportId]);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Report not found' });
    }

    await query('UPDATE message_report SET status = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2', [status, reportId]);

    // Log admin action
    if (adminId) {
      await query(
        'INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, metadata, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
        [adminId, 'update_report_status', 'message_report', reportId, adminNote || null, JSON.stringify({ status })]
      );
    }

    return res.json({ status: 'success', message: 'Message report status updated' });
  } catch (error) {
    console.error('Error updating message report status:', error);
    return res.status(500).json({ status: 'error', message: 'Error updating message report status' });
  }
});

// Delete a message report (rarely used; retention preferred)
router.delete('/message-reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const adminId = req.user?.id || null;
    const existing = await queryOne('SELECT id FROM message_report WHERE id = $1', [reportId]);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Report not found' });
    }
    await query('DELETE FROM message_report WHERE id = $1', [reportId]);
    if (adminId) {
      await query(
        'INSERT INTO admin_action_log ("adminId", action, "targetTable", "targetId", reason, metadata, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
        [adminId, 'delete_report', 'message_report', reportId, null, JSON.stringify({})]
      );
    }
    return res.json({ status: 'success', message: 'Message report deleted' });
  } catch (error) {
    console.error('Error deleting message report:', error);
    return res.status(500).json({ status: 'error', message: 'Error deleting message report' });
  }
});

// Message report statistics
router.get('/message-reports/stats', async (req, res) => {
  try {
    const totalRow = await queryOne('SELECT COUNT(*)::int AS total FROM message_report');
    const statusRows = await query('SELECT status, COUNT(*)::int AS count FROM message_report GROUP BY status');
    const topReasons = await query('SELECT reason, COUNT(*)::int AS count FROM message_report GROUP BY reason ORDER BY count DESC LIMIT 5');
    return res.json({
      status: 'success',
      payload: {
        totalReports: totalRow.total || 0,
        statusBreakdown: statusRows,
        topReasons: topReasons
      }
    });
  } catch (error) {
    console.error('Error fetching message report stats:', error);
    return res.status(500).json({ status: 'error', message: 'Error fetching message report stats' });
  }
});

// Message report details (single message content only)
router.get('/message-reports/:reportId/details', async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await queryOne(`
      SELECT mr.id, mr.reason, mr.description, mr.status, mr."createdAt", m.id AS "messageId", m.content,
             m."authorId", u.username AS authorUsername, u.name AS authorName
      FROM message_report mr
      JOIN message m ON mr."messageId" = m.id
      JOIN "user" u ON m."authorId" = u.id
      WHERE mr.id = $1
    `, [reportId]);
    if (!report) {
      return res.status(404).json({ status: 'error', message: 'Report not found' });
    }
    return res.json({
      status: 'success',
      payload: {
        id: report.id,
        reason: report.reason,
        description: report.description,
        status: report.status,
        reportedAt: report.createdAt,
        message: {
          id: report.messageId,
            content: report.content,
            authorId: report.authorId,
            authorUsername: report.authorusername || report.authorusername, // ensure casing safe
            authorName: report.authorname || report.authorname
        }
      }
    });
  } catch (error) {
    console.error('Error fetching report details:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch report details' });
  }
});

/**
 * === USER MODERATION SUMMARY & ACTIONS ===
 */
router.get('/users/:userId/moderation-summary', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await queryOne('SELECT id, email, username, name, "createdAt" FROM "user" WHERE id = $1', [userId]);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    const totals = await queryOne(`
      SELECT
        COALESCE(COUNT(mr.id),0)::int AS total,
        COALESCE(SUM(CASE WHEN mr.status = 'pending' THEN 1 ELSE 0 END),0)::int AS pending
      FROM message_report mr
      JOIN message m ON mr."messageId" = m.id
      WHERE m."authorId" = $1
    `, [userId]);

    const volumes = await queryOne(`
      SELECT
        COALESCE(SUM(CASE WHEN m."createdAt" >= (CURRENT_TIMESTAMP - INTERVAL '24 hours') THEN 1 ELSE 0 END),0)::int AS last24h,
        COALESCE(SUM(CASE WHEN m."createdAt" >= (CURRENT_TIMESTAMP - INTERVAL '7 days') THEN 1 ELSE 0 END),0)::int AS last7d
      FROM message m WHERE m."authorId" = $1
    `, [userId]);

    const activeRestriction = await queryOne(`
      SELECT id, type, reason, "createdAt", "expiresAt" FROM user_restriction
      WHERE "userId" = $1 AND type = 'messaging'
        AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP)
      ORDER BY "createdAt" DESC LIMIT 1
    `, [userId]);

    const recentReports = await query(`
      SELECT mr.id, mr.reason, mr.status, mr."createdAt",
             LEFT(m.content, 140) AS snippet
      FROM message_report mr
      JOIN message m ON mr."messageId" = m.id
      WHERE m."authorId" = $1
      ORDER BY mr."createdAt" DESC LIMIT 5
    `, [userId]);

    return res.json({
      status: 'success',
      payload: {
        user,
        totals,
        volumes,
        activeRestriction: activeRestriction || null,
        recentReports
      }
    });
  } catch (error) {
    console.error('Error fetching moderation summary:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch moderation summary' });
  }
});

router.post('/users/:userId/warn', async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user?.id;
    const { reason = 'Community Guidelines Warning', note } = req.body || {};
    const user = await queryOne('SELECT id FROM "user" WHERE id = $1', [userId]);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    const content = note ? `${reason}: ${note}` : `${reason}. Please review our messaging rules.`;
    await createNotification('MESSAGE', Number(userId), adminId || null, content, {});
    await softDeleteService.logAdminAction(adminId || null, 'warn_user', 'user', Number(userId), reason, { note });
    return res.json({ status: 'success', message: 'Warning sent to user' });
  } catch (error) {
    console.error('Error warning user:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to warn user' });
  }
});

router.post('/users/:userId/restrict-messaging', async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user?.id || null;
    const { durationMinutes = 1440, reason = 'Messaging restriction due to policy violation' } = req.body || {};
    const user = await queryOne('SELECT id FROM "user" WHERE id = $1', [userId]);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    const minutes = Math.max(1, Number(durationMinutes));
    const ins = await query(`
      INSERT INTO user_restriction ("userId", type, reason, "adminId", metadata, "expiresAt")
      VALUES ($1, 'messaging', $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '${minutes} minutes')
      RETURNING id, "expiresAt"`, [userId, reason, adminId, JSON.stringify({ source: 'admin_panel' })]);
    await softDeleteService.logAdminAction(adminId, 'restrict_messaging', 'user', Number(userId), reason, { durationMinutes: minutes });
    return res.json({ status: 'success', message: 'Messaging restriction applied', payload: ins.rows?.[0] || null });
  } catch (error) {
    console.error('Error restricting messaging:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to apply restriction' });
  }
});

router.post('/users/:userId/unrestrict-messaging', async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user?.id || null;
    await query(`UPDATE user_restriction SET "expiresAt" = CURRENT_TIMESTAMP
                 WHERE "userId" = $1 AND type = 'messaging'
                   AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP)`, [userId]);
    await softDeleteService.logAdminAction(adminId, 'lift_restriction', 'user', Number(userId), 'Lifted messaging restriction');
    return res.json({ status: 'success', message: 'Messaging restriction lifted' });
  } catch (error) {
    console.error('Error lifting restriction:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to lift restriction' });
  }
});

/**
 * Spam detection (heuristic, privacy-preserving):
 * We flag messages that meet simple patterns without exposing entire conversation history.
 * Heuristics:
 *  - High duplicate ratio: same content sent >=3 times by same sender within last 2 hours
 *  - Excessive links: >=3 URLs in message
 *  - Keyword spam: contains repeated scam phrases (e.g., 'free money', 'click here')
 * Returns limited snippet, sender, detection reason, score, and timestamp.
 */
router.get('/message-reports/spam-detection', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    // Duplicate content heuristic (same content >=3x last 2h)
    const duplicates = await query(`
      SELECT m."authorId" as senderId, u.username as senderUsername, m.content,
             COUNT(*) as occurrences,
             MIN(m."createdAt") as firstSeen,
             MAX(m."createdAt") as lastSeen
      FROM message m
      JOIN "user" u ON u.id = m."authorId"
      WHERE m."createdAt" > NOW() - INTERVAL '2 hours'
      GROUP BY m."authorId", u.username, m.content
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC
    `);

    // High volume heuristic (>=100 messages in last 1 minute)
    const highVolume = await query(`
      SELECT m."authorId" as senderId, u.username as senderUsername, COUNT(*) as msg_count,
             MAX(m."createdAt") as lastSeen
      FROM message m
      JOIN "user" u ON u.id = m."authorId"
      WHERE m."createdAt" > NOW() - INTERVAL '1 minute'
      GROUP BY m."authorId", u.username
      HAVING COUNT(*) >= 100
      ORDER BY COUNT(*) DESC
    `);

    // Build candidate list with scoring
    const candidates = [];
    const urlRegex = /(https?:\/\/|www\.)[\w.-]+/gi;
    const spamPhrases = ['free money', 'click here', 'investment guaranteed', 'easy cash'];

    for (const row of duplicates) {
      const linkCount = (row.content.match(urlRegex) || []).length;
      let phraseHits = 0;
      const lowered = row.content.toLowerCase();
      for (const phrase of spamPhrases) {
        if (lowered.includes(phrase)) phraseHits++;
      }
      // Simple score formula
      const score = (row.occurrences * 20) + (linkCount * 15) + (phraseHits * 25);
      let reasonParts = [];
      if (row.occurrences >= 3) reasonParts.push(`Repeated ${row.occurrences}x`);
      if (linkCount >= 3) reasonParts.push('Excessive links');
      if (phraseHits > 0) reasonParts.push('Spam phrases');
      const reason = reasonParts.join(' / ') || 'Pattern match';
      candidates.push({
        id: `${row.senderId}-${row.firstSeen}`,
        messageId: null, // not tying to a single message to avoid exposing thread; could map later
        senderId: row.senderId,
        senderUsername: row.senderUsername,
        messageContent: row.content,
        score,
        reason,
        detectedAt: row.lastSeen,
        status: 'pending'
      });
    }

    // High volume candidates (no content bulk exposure; fetch a representative latest message)
    for (const hv of highVolume) {
      const latestMessage = await queryOne(`
        SELECT content FROM message WHERE "authorId" = $1 ORDER BY "createdAt" DESC LIMIT 1
      `, [hv.senderId]);
      const representativeContent = latestMessage ? latestMessage.content : '[content unavailable]';
      const linkCount = (representativeContent.match(urlRegex) || []).length;
      const lowered = representativeContent.toLowerCase();
      let phraseHits = 0; spamPhrases.forEach(p => { if (lowered.includes(p)) phraseHits++; });
      const score = (hv.msg_count * 0.5) + (linkCount * 10) + (phraseHits * 20) + 50; // base weight for volume
      let reasonParts = [`High volume ${hv.msg_count} msgs/1min`];
      if (linkCount >= 3) reasonParts.push('Excessive links');
      if (phraseHits > 0) reasonParts.push('Spam phrases');
      candidates.push({
        id: `${hv.senderId}-vol-${hv.lastSeen}`,
        messageId: null,
        senderId: hv.senderId,
        senderUsername: hv.senderUsername,
        messageContent: representativeContent.slice(0, 300), // cap snippet length
        score,
        reason: reasonParts.join(' / '),
        detectedAt: hv.lastSeen,
        status: 'pending'
      });
    }

    // Pagination on candidates
    const paged = candidates.slice(offset, offset + limit);
    return res.json({
      status: 'success',
      payload: {
        items: paged,
        pagination: {
          page,
          limit,
          total: candidates.length,
          totalPages: Math.max(1, Math.ceil(candidates.length / limit))
        }
      }
    });
  } catch (error) {
    console.error('Spam detection error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to run spam detection' });
  }
});

// === SOFT DELETE MANAGEMENT ENDPOINTS ===

// Delete user (Soft Delete)
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    // Prevent deleting admin user
    if (userId === '1' || userId === adminId.toString()) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete admin user or yourself'
      });
    }
    
    // Check if user exists and is not already deleted
    const user = await queryOne('SELECT * FROM "user" WHERE id = $1 AND "deletedAt" IS NULL', [userId]);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found or already deleted'
      });
    }
    
    // Perform soft delete
    await softDeleteService.softDelete('user', userId, adminId, reason);

    // Fire-and-forget email notification (don't block success if email fails)
    (async () => {
      try {
        const emailReady = await emailService.ensureTransporter();
        const emailResult = await emailService.sendAccountArchivedEmail(user.email, user.name, reason);
        if (!emailResult.success) {
          console.warn('⚠️ Archive email failed to send:', { userId, email: user.email, error: emailResult.error });
        } else {
          console.log('📧 Archive email sent:', { userId, email: user.email, messageId: emailResult.messageId });
        }
      } catch (e) {
        console.error('Email send failed for archived user:', e?.message || e);
      }
    })();

    res.json({
      status: 'success',
      message: 'User soft deleted successfully'
    });
  } catch (error) {
    console.error('Error soft deleting user:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error deleting user'
    });
  }
});

// Restore deleted record
router.post('/:table/:id/restore', async (req, res) => {
  try {
    const { table, id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    console.log(`Restore request - Table: ${table}, ID: ${id}, Admin: ${adminId}, Reason: ${reason}`);
    
    // Validate table name for security
    const allowedTables = ['user', 'post', 'listing', 'comment', 'message', 'media', 'profile'];
    if (!allowedTables.includes(table)) {
      console.log(`Invalid table name: ${table}`);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid table name'
      });
    }
    
    // Perform restore
    const success = await softDeleteService.restore(table, id, adminId, reason);
    console.log(`Restore operation result: ${success}`);
    
    if (success) {
      const response = {
        status: 'success',
        message: `${table} record restored successfully`
      };
      console.log('Sending success response:', response);
      res.json(response);
    } else {
      const errorResponse = {
        status: 'error',
        message: 'Failed to restore record'
      };
      console.log('Sending error response:', errorResponse);
      res.status(400).json(errorResponse);
    }
  } catch (error) {
    console.error('Error restoring record:', error);
    const errorResponse = {
      status: 'error',
      message: error.message || 'Error restoring record'
    };
    console.log('Sending catch error response:', errorResponse);
    res.status(500).json(errorResponse);
  }
});

// Get deleted records for a table
router.get('/:table/deleted', async (req, res) => {
  try {
    const { table } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    // Validate table name for security
    const allowedTables = ['user', 'post', 'listing', 'comment', 'message', 'media', 'profile'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid table name'
      });
    }
    
    const result = await softDeleteService.getDeletedRecords(table, page, limit);
    
    res.json({
      status: 'success',
      payload: result
    });
  } catch (error) {
    console.error('Error fetching deleted records:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching deleted records'
    });
  }
});

// Permanently delete a record (bypass soft delete)
router.delete('/:table/:id/permanent', async (req, res) => {
  try {
    const { table, id } = req.params;
    const { reason, confirmPermanent } = req.body;
    const adminId = req.user.id;
    
    // Require explicit confirmation for permanent deletion
    if (!confirmPermanent) {
      return res.status(400).json({
        status: 'error',
        message: 'Permanent deletion requires explicit confirmation'
      });
    }
    
    // Validate table name for security
    const allowedTables = ['user', 'post', 'listing', 'comment', 'message', 'media', 'profile'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid table name'
      });
    }
    
    // Perform permanent delete
    const success = await softDeleteService.permanentDelete(table, id, adminId, reason);
    
    if (success) {
      res.json({
        status: 'success',
        message: `${table} record permanently deleted`
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Failed to permanently delete record'
      });
    }
  } catch (error) {
    console.error('Error permanently deleting record:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error permanently deleting record'
    });
  }
});

// Get admin action logs
router.get('/actions/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const tableFilter = req.query.table;
    const actionFilter = req.query.action;
    
    const logs = await softDeleteService.getAdminActionLogs(page, limit, tableFilter, actionFilter);
    
    res.json({
      status: 'success',
      payload: logs
    });
  } catch (error) {
    console.error('Error fetching admin action logs:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching admin action logs'
    });
  }
});

// Archive cleanup endpoints
const archiveCleanupService = require('../services/archive-cleanup.service');

// Get cleanup statistics
router.get('/archive/stats', async (req, res) => {
  try {
    const stats = await archiveCleanupService.getCleanupStats();
    res.json({
      status: 'success',
      payload: stats
    });
  } catch (error) {
    console.error('Error fetching cleanup stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching cleanup statistics'
    });
  }
});

// Trigger manual cleanup
router.post('/archive/cleanup', async (req, res) => {
  try {
    const adminId = req.user.id;
    const { reason } = req.body;
    
    // Start manual cleanup (async)
    archiveCleanupService.manualCleanup(adminId, reason || 'Manual cleanup triggered by admin');
    
    res.json({
      status: 'success',
      message: 'Manual cleanup process started'
    });
  } catch (error) {
    console.error('Error starting manual cleanup:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error starting cleanup process'
    });
  }
});

module.exports = router;

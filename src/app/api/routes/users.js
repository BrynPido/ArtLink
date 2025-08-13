const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, queryOne } = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const wsService = require('../services/websocket-service');

const router = express.Router();

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/profiles');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get user profile by ID
router.get('/user/:id', optionalAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user?.id || null;

    // Get user profile with follower/following counts
    const user = await queryOne(`
      SELECT 
        u.id, u.name, u.username, u.email,
        p.bio, p."profilePictureUrl",
        (SELECT COUNT(*) FROM follow WHERE "followingId" = u.id) as "followersCount",
        (SELECT COUNT(*) FROM follow WHERE "followerId" = u.id) as "followingCount",
        (SELECT COUNT(*) FROM post WHERE "authorId" = u.id AND published = true) as "postsCount",
        (SELECT COUNT(*) FROM listing WHERE "authorId" = u.id) as "listingsCount",
        ${currentUserId ? 
          '(SELECT COUNT(*) FROM follow WHERE "followerId" = $1 AND "followingId" = u.id) as "isFollowing"' : 
          '0 as "isFollowing"'
        }
      FROM "user" u
      LEFT JOIN profile p ON u.id = p."userId"
      WHERE u.id = $${currentUserId ? '2' : '1'}
    `, currentUserId ? [currentUserId, userId] : [userId]);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get user's posts
    const posts = await query(`
      SELECT 
        p.id, p.title, p.content, p."createdAt", p."updatedAt",
        STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls",
        COUNT(DISTINCT l.id) as "likesCount",
        COUNT(DISTINCT c.id) as "commentsCount",
        COUNT(DISTINCT s.id) as "savesCount",
        ${currentUserId ? 'MAX(CASE WHEN l."userId" = $1 THEN 1 ELSE 0 END)' : '0'} as "isLiked",
        ${currentUserId ? 'MAX(CASE WHEN s."userId" = $2 THEN 1 ELSE 0 END)' : '0'} as "isSaved"
      FROM post p
      LEFT JOIN media m ON p.id = m."postId"
      LEFT JOIN "like" l ON p.id = l."postId"
      LEFT JOIN comment c ON p.id = c."postId"
      LEFT JOIN save s ON p.id = s."postId"
      WHERE p."authorId" = $${currentUserId ? '3' : '1'} AND p.published = true
      GROUP BY p.id
      ORDER BY p."createdAt" DESC
    `, currentUserId ? [currentUserId, currentUserId, userId] : [userId]);

    const processedPosts = posts.map(post => ({
      ...post,
      mediaUrls: post.mediaUrls ? post.mediaUrls.split(',') : [],
      isLiked: Boolean(post.isLiked),
      isSaved: Boolean(post.isSaved)
    }));

    res.json({
      status: 'success',
      payload: {
        user: {
          ...user,
          isFollowing: Boolean(user.isFollowing)
        },
        posts: processedPosts
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user profile'
    });
  }
});

// Toggle follow/unfollow user
router.post('/toggleFollow', authenticateToken, async (req, res) => {
  try {
    const { followingId } = req.body;
    const followerId = req.user.id;

    if (followerId === followingId) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot follow yourself'
      });
    }

    // Check if already following
    const existingFollow = await queryOne(
      'SELECT id FROM follow WHERE "followerId" = $1 AND "followingId" = $2',
      [followerId, followingId]
    );

    if (existingFollow) {
      // Unfollow
      await query('DELETE FROM follow WHERE id = $1', [existingFollow.id]);
      res.json({
        status: 'success',
        message: 'User unfollowed',
        payload: { following: false }
      });
    } else {
      // Follow
      const result = await query(
        'INSERT INTO follow ("followerId", "followingId", "createdAt", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [followerId, followingId]
      );

      // Get follower's info for notification
      const follower = await queryOne(
        'SELECT name, username FROM "user" WHERE id = $1',
        [followerId]
      );

      // Create follow notification
      if (follower) {
        const notificationContent = `${follower.name} (@${follower.username}) started following you`;
        
        // Create database notification
        await createNotification(
          'FOLLOW',
          followingId,
          followerId,
          notificationContent,
          { followId: result.insertId }
        );
        
        // Send real-time WebSocket notification
        wsService.sendNotification(followingId, {
          type: 'FOLLOW',
          message: notificationContent,
          userId: followerId,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        status: 'success',
        message: 'User followed',
        payload: { following: true }
      });
    }

  } catch (error) {
    console.error('Toggle follow error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to follow/unfollow user'
    });
  }
});

// Check if following a user
router.get('/following/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const followerId = req.user.id;

    const following = await queryOne(
      'SELECT id FROM follow WHERE "followerId" = $1 AND "followingId" = $2',
      [followerId, userId]
    );

    res.json({
      status: 'success',
      payload: {
        following: Boolean(following)
      }
    });

  } catch (error) {
    console.error('Check following error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check follow status'
    });
  }
});

// Get users that current user is following
router.get('/:userId/following', optionalAuth, async (req, res) => {
  try {
    const userId = req.params.userId;

    const following = await query(`
      SELECT 
        u.id, u.name, u.username,
        p."profilePictureUrl",
        f."createdAt" as "followedAt"
      FROM follow f
      LEFT JOIN "user" u ON f."followingId" = u.id
      LEFT JOIN profile p ON u.id = p."userId"
      WHERE f."followerId" = $1
      ORDER BY f."createdAt" DESC
    `, [userId]);

    // Transform the data to fix image URLs
    const transformedFollowing = following.map(user => {
      let imageProfile = null;
      if (user.profilePictureUrl) {
        // If it's already a full URL, use it as is
        if (user.profilePictureUrl.startsWith('http')) {
          imageProfile = user.profilePictureUrl;
        } else {
          // If it's a relative path, construct the full URL without /api prefix
          // Remove leading slash if present to avoid double slashes
          const cleanPath = user.profilePictureUrl.startsWith('/') 
            ? user.profilePictureUrl.substring(1) 
            : user.profilePictureUrl;
          imageProfile = `${req.protocol}://${req.get('host')}/${cleanPath}`;
        }
      }

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        imageProfile: imageProfile,
        profilePictureUrl: imageProfile,
        followedAt: user.followedAt
      };
    });

    res.json({
      status: 'success',
      payload: transformedFollowing
    });

  } catch (error) {
    console.error('Get following users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch following users'
    });
  }
});

// Get user followers
router.get('/:userId/followers', optionalAuth, async (req, res) => {
  try {
    const userId = req.params.userId;

    const followers = await query(`
      SELECT 
        u.id, u.name, u.username,
        p."profilePictureUrl",
        f."createdAt" as "followedAt"
      FROM follow f
      LEFT JOIN "user" u ON f."followerId" = u.id
      LEFT JOIN profile p ON u.id = p."userId"
      WHERE f."followingId" = $1
      ORDER BY f."createdAt" DESC
    `, [userId]);

    // Transform the data to fix image URLs
    const transformedFollowers = followers.map(user => {
      let imageProfile = null;
      if (user.profilePictureUrl) {
        // If it's already a full URL, use it as is
        if (user.profilePictureUrl.startsWith('http')) {
          imageProfile = user.profilePictureUrl;
        } else {
          // If it's a relative path, construct the full URL without /api prefix
          // Remove leading slash if present to avoid double slashes
          const cleanPath = user.profilePictureUrl.startsWith('/') 
            ? user.profilePictureUrl.substring(1) 
            : user.profilePictureUrl;
          imageProfile = `${req.protocol}://${req.get('host')}/${cleanPath}`;
        }
      }

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        imageProfile: imageProfile,
        profilePictureUrl: imageProfile,
        followedAt: user.followedAt
      };
    });

    res.json({
      status: 'success',
      payload: transformedFollowers
    });

  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch followers'
    });
  }
});

// Update profile picture
router.post('/updateProfile', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { imageData } = req.body;
    
    let profilePictureUrl = null;

    // Handle file upload or base64 image data
    if (req.file) {
      profilePictureUrl = `/uploads/profiles/${req.file.filename}`;
    } else if (imageData) {
      // Handle base64 image data
      const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const imageType = matches[1];
        const imageBuffer = Buffer.from(matches[2], 'base64');
        
        // Validate image type
        if (!imageType.startsWith('image/')) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid image data'
          });
        }

        // Generate filename
        const extension = imageType.split('/')[1];
        const filename = `profile-${Date.now()}-${Math.round(Math.random() * 1E9)}.${extension}`;
        const uploadPath = path.join(__dirname, '../uploads/profiles');
        
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }

        // Save file
        const filePath = path.join(uploadPath, filename);
        fs.writeFileSync(filePath, imageBuffer);
        
        profilePictureUrl = `/uploads/profiles/${filename}`;
      }
    }

    if (!profilePictureUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid image provided'
      });
    }

    // Update profile
    await query(
      'UPDATE profile SET "profilePictureUrl" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $2',
      [profilePictureUrl, userId]
    );

    res.json({
      status: 'success',
      message: 'Profile picture updated successfully',
      payload: {
        profilePictureUrl,
        imageProfile: profilePictureUrl // Add for backward compatibility
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile picture'
    });
  }
});

// Update bio
router.post('/updateBio', authenticateToken, async (req, res) => {
  try {
    const { bio } = req.body;
    const userId = req.user.id;

    if (bio && bio.length > 500) {
      return res.status(400).json({
        status: 'error',
        message: 'Bio must be less than 500 characters'
      });
    }

    await query(
      'UPDATE profile SET bio = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $2',
      [bio || '', userId]
    );

    res.json({
      status: 'success',
      message: 'Bio updated successfully',
      payload: {
        bio: bio || ''
      }
    });

  } catch (error) {
    console.error('Update bio error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update bio'
    });
  }
});

// Search users
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { query: searchQuery } = req.query;

    if (!searchQuery) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query is required'
      });
    }

    const users = await query(`
      SELECT 
        u.id, u.name, u.username,
        p."profilePictureUrl",
        (SELECT COUNT(*) FROM follow WHERE "followingId" = u.id) as "followersCount",
        (SELECT COUNT(*) FROM post WHERE "authorId" = u.id AND published = true) as "postsCount"
      FROM "user" u
      LEFT JOIN profile p ON u.id = p."userId"
      WHERE (u.name ILIKE $1 OR u.username ILIKE $2)
      AND u.id != 1
      AND u.username != 'admin'
      ORDER BY "followersCount" DESC, "postsCount" DESC
      LIMIT 20
    `, [`%${searchQuery}%`, `%${searchQuery}%`]);

    res.json({
      status: 'success',
      payload: users
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search users'
    });
  }
});

// Get suggested users for explore page
router.get('/suggested', optionalAuth, async (req, res) => {
  try {
    const currentUserId = req.user?.id || null;
    
    if (!currentUserId) {
      // For non-authenticated users, just show most popular users (excluding admin)
      const sql = `
        SELECT 
          u.id,
          u.name,
          u.username,
          p.profilePictureUrl,
          COUNT(DISTINCT f.followerId) as followersCount,
          COUNT(DISTINCT posts.id) as postsCount,
          'popular' as suggestionType
        FROM user u
        LEFT JOIN profile p ON u.id = p.userId
        LEFT JOIN follow f ON u.id = f.followingId
        LEFT JOIN post posts ON u.id = posts.authorId
        WHERE u.username != 'admin' 
        AND u.id != 1
        GROUP BY u.id, u.name, u.username, p.profilePictureUrl
        ORDER BY followersCount DESC, postsCount DESC
        LIMIT 10
      `;
      
      const users = await query(sql, []);
      return res.json({
        status: 'success',
        payload: users
      });
    }
    
    // For authenticated users, implement "someone you know" logic
    const sql = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.username,
        p.profilePictureUrl,
        COUNT(DISTINCT f_all.followerId) as followersCount,
        COUNT(DISTINCT posts.id) as postsCount,
        
        -- Check if this user is followed by someone the current user follows
        COUNT(DISTINCT mutual_connections.followerId) as mutualConnectionsCount,
        
        -- Determine suggestion type
        CASE 
          WHEN COUNT(DISTINCT mutual_connections.followerId) > 0 THEN 'friends_of_friends'
          ELSE 'popular'
        END as suggestionType,
        
        -- Get names of mutual connections (up to 3)
        GROUP_CONCAT(
          DISTINCT CASE 
            WHEN mutual_connections.followerId IS NOT NULL 
            THEN mutual_friends.name 
            END 
          ORDER BY mutual_friends.name 
          LIMIT 3
        ) as mutualFriendsNames
        
      FROM user u
      LEFT JOIN profile p ON u.id = p.userId
      LEFT JOIN follow f_all ON u.id = f_all."followingId"
      LEFT JOIN post posts ON u.id = posts."authorId"
      
      -- Find users who are followed by people that the current user follows
      LEFT JOIN follow mutual_connections ON (
        u.id = mutual_connections."followingId" 
        AND mutual_connections."followerId" IN (
          SELECT "followingId" FROM follow WHERE "followerId" = $1
        )
      )
      LEFT JOIN "user" mutual_friends ON mutual_connections."followerId" = mutual_friends.id
      
      WHERE u.id != $2  -- Exclude current user
      AND u.id != 1   -- Exclude admin user
      AND u.username != 'admin'  -- Extra safety check for admin
      AND u.id NOT IN (  -- Exclude users already followed
        SELECT "followingId" FROM follow WHERE "followerId" = $3
      )
      
      GROUP BY u.id, u.name, u.username, p."profilePictureUrl"
      
      -- Order by: friends of friends first, then by engagement
      ORDER BY 
        mutualConnectionsCount DESC,
        followersCount DESC, 
        postsCount DESC
      LIMIT 15
    `;

    const users = await query(sql, [currentUserId, currentUserId, currentUserId]);

    res.json({
      status: 'success',
      payload: users
    });

  } catch (error) {
    console.error('Get suggested users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get suggested users'
    });
  }
});

module.exports = router;

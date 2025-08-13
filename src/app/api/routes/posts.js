const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, queryOne, transaction } = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validatePost, validateComment, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Create a new post with base64 media support
router.post('/createPost', authenticateToken, async (req, res) => {
  try {
    const { title, content, media } = req.body;
    const userId = req.user.id;

    const result = await transaction(async (connection) => {
      // Insert post
      const postResult = await connection.query(
        'INSERT INTO post (title, content, "authorId", published, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
        [title, content || '', userId, true]
      );

      const postId = postResult.rows[0].id;

      // Handle media if provided
      if (media && Array.isArray(media) && media.length > 0) {
        const uploadPath = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }

        for (const mediaItem of media) {
          let mediaUrl = mediaItem.url;
          let mediaType = mediaItem.mediaType || 'image';

          // If it's a base64 data URL, save it as a file
          if (mediaUrl && mediaUrl.startsWith('data:')) {
            try {
              const matches = mediaUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
              if (matches && matches.length === 3) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                
                // Generate unique filename
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const extension = mimeType.split('/')[1] || 'jpg';
                const filename = `${uniqueSuffix}.${extension}`;
                const filePath = path.join(uploadPath, filename);
                
                // Save base64 data as file
                fs.writeFileSync(filePath, base64Data, 'base64');
                mediaUrl = `/uploads/${filename}`;
                mediaType = mimeType;
              }
            } catch (saveError) {
              console.error('Error saving base64 media:', saveError);
              // Continue with the original URL if saving fails
            }
          }

          await connection.query(
            'INSERT INTO media ("postId", "mediaUrl", "mediaType", "createdAt", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [postId, mediaUrl, mediaType]
          );
        }
      }

      return postId;
    });

    res.status(201).json({
      status: 'success',
      message: 'Post created successfully',
      payload: { postId: result }
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create post'
    });
  }
});

// Create a new post with file upload (legacy)
router.post('/createPostFile', authenticateToken, upload.array('media', 5), async (req, res) => {
  try {
    const { title, content } = req.body;
    const userId = req.user.id;
    const files = req.files || [];

    const result = await transaction(async (connection) => {
      // Insert post
      const postResult = await connection.query(
        'INSERT INTO post (title, content, "authorId", published, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
        [title, content || '', userId, true]
      );

      const postId = postResult.rows[0].id;

      // Insert media if files were uploaded
      if (files.length > 0) {
        for (const file of files) {
          await connection.query(
            'INSERT INTO media ("postId", "mediaUrl", "mediaType", "createdAt", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [postId, `/uploads/${file.filename}`, file.mimetype]
          );
        }
      }

      return postId;
    });

    res.status(201).json({
      status: 'success',
      message: 'Post created successfully',
      payload: { postId: result }
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create post'
    });
  }
});

// Get all posts (with pagination)
router.get('/getPosts', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const posts = await query(`
      SELECT 
        p.id, p.title, p.content, p."createdAt", p."updatedAt",
        u.id as "authorId", u.name as "authorName", u.username as "authorUsername",
        pr."profilePictureUrl" as "authorProfilePicture",
        STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls",
        COUNT(DISTINCT l.id) as "likesCount",
        COUNT(DISTINCT c.id) as "commentsCount",
        COUNT(DISTINCT s.id) as "savesCount",
        ${userId ? 'MAX(CASE WHEN l."userId" = $1 THEN 1 ELSE 0 END)' : '0'} as "isLiked",
        ${userId ? 'MAX(CASE WHEN s."userId" = $2 THEN 1 ELSE 0 END)' : '0'} as "isSaved"
      FROM post p
      LEFT JOIN "user" u ON p."authorId" = u.id
      LEFT JOIN profile pr ON u.id = pr."userId"
      LEFT JOIN media m ON p.id = m."postId"
      LEFT JOIN "like" l ON p.id = l."postId"
      LEFT JOIN comment c ON p.id = c."postId"
      LEFT JOIN save s ON p.id = s."postId"
      WHERE p.published = true
      GROUP BY p.id, u.id, pr."profilePictureUrl"
      ORDER BY p."createdAt" DESC
      LIMIT $${userId ? '3' : '1'} OFFSET $${userId ? '4' : '2'}
    `, userId ? [userId, userId, limit, offset] : [limit, offset]);

    // Process media URLs
    const processedPosts = posts.map(post => ({
      ...post,
      mediaUrls: post.mediaUrls ? post.mediaUrls.split(',') : [],
      isLiked: Boolean(post.isLiked),
      isSaved: Boolean(post.isSaved)
    }));

    res.json({
      status: 'success',
      payload: {
        posts: processedPosts,
        pagination: {
          page,
          limit,
          hasMore: posts.length === limit
        }
      }
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch posts'
    });
  }
});

// Get single post by ID
router.get('/post/:id', optionalAuth, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user?.id || null;

    const post = await queryOne(`
      SELECT 
        p.id, p.title, p.content, p."createdAt", p."updatedAt",
        u.id as "authorId", u.name as "authorName", u.username as "authorUsername",
        pr."profilePictureUrl" as "authorProfilePicture",
        STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls",
        COUNT(DISTINCT l.id) as "likesCount",
        COUNT(DISTINCT c.id) as "commentsCount",
        COUNT(DISTINCT s.id) as "savesCount",
        ${userId ? 'MAX(CASE WHEN l."userId" = $1 THEN 1 ELSE 0 END)' : '0'} as "isLiked",
        ${userId ? 'MAX(CASE WHEN s."userId" = $2 THEN 1 ELSE 0 END)' : '0'} as "isSaved"
      FROM post p
      LEFT JOIN "user" u ON p."authorId" = u.id
      LEFT JOIN profile pr ON u.id = pr."userId"
      LEFT JOIN media m ON p.id = m."postId"
      LEFT JOIN "like" l ON p.id = l."postId"
      LEFT JOIN comment c ON p.id = c."postId"
      LEFT JOIN save s ON p.id = s."postId"
      WHERE p.id = $${userId ? '3' : '1'} AND p.published = true
      GROUP BY p.id, u.id, pr."profilePictureUrl"
    `, userId ? [userId, userId, postId] : [postId]);

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    // Get comments for this post
    const comments = await query(`
      SELECT 
        c.id, c.content, c."createdAt", c."parentId",
        u.id as "authorId", u.name as "authorName", u.username as "authorUsername",
        pr."profilePictureUrl" as "authorProfilePicture",
        COUNT(DISTINCT cl.id) as "likesCount",
        ${userId ? 'MAX(CASE WHEN cl."userId" = $1 THEN 1 ELSE 0 END)' : '0'} as "isLiked"
      FROM comment c
      LEFT JOIN "user" u ON c."authorId" = u.id
      LEFT JOIN profile pr ON u.id = pr."userId"
      LEFT JOIN "like" cl ON c.id = cl."commentId"
      WHERE c."postId" = $${userId ? '2' : '1'}
      GROUP BY c.id, u.id, pr."profilePictureUrl"
      ORDER BY c."createdAt" ASC
    `, userId ? [userId, postId] : [postId]);

    const processedPost = {
      ...post,
      mediaUrls: post.mediaUrls ? post.mediaUrls.split(',') : [],
      isLiked: Boolean(post.isLiked),
      isSaved: Boolean(post.isSaved),
      comments: comments.map(comment => ({
        ...comment,
        isLiked: Boolean(comment.isLiked)
      }))
    };

    res.json({
      status: 'success',
      payload: processedPost
    });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch post'
    });
  }
});

// Like/unlike a post
router.post('/likePost', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;

    // Check if already liked
    const existingLike = await queryOne(
      'SELECT id FROM "like" WHERE "postId" = $1 AND "userId" = $2',
      [postId, userId]
    );

    if (existingLike) {
      // Unlike
      await query('DELETE FROM "like" WHERE id = $1', [existingLike.id]);
      res.json({
        status: 'success',
        message: 'Post unliked',
        payload: { liked: false }
      });
    } else {
      // Like
      await query(
        'INSERT INTO "like" ("postId", "userId", "createdAt", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [postId, userId]
      );
      res.json({
        status: 'success',
        message: 'Post liked',
        payload: { liked: true }
      });
    }

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to like/unlike post'
    });
  }
});

// Save/unsave a post
router.post('/savePost', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;

    // Check if already saved
    const existingSave = await queryOne(
      'SELECT id FROM save WHERE "postId" = $1 AND "userId" = $2',
      [postId, userId]
    );

    if (existingSave) {
      // Unsave
      await query('DELETE FROM save WHERE id = $1', [existingSave.id]);
      res.json({
        status: 'success',
        message: 'Post unsaved',
        payload: { saved: false }
      });
    } else {
      // Save
      await query(
        'INSERT INTO save ("postId", "userId", "createdAt", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [postId, userId]
      );
      res.json({
        status: 'success',
        message: 'Post saved',
        payload: { saved: true }
      });
    }

  } catch (error) {
    console.error('Save post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save/unsave post'
    });
  }
});

// Delete a post
router.post('/deletePost', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;

    // Check if user owns the post
    const post = await queryOne(
      'SELECT id, "authorId" FROM post WHERE id = $1',
      [postId]
    );

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    if (post.authorId !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized to delete this post'
      });
    }

    // Delete post (CASCADE will handle related records)
    await query('DELETE FROM post WHERE id = $1', [postId]);

    res.json({
      status: 'success',
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete post'
    });
  }
});

// Add comment to post
router.post('/addComment', authenticateToken, validateComment, handleValidationErrors, async (req, res) => {
  try {
    const { content, postId, parentId } = req.body;
    const authorId = req.user.id;

    const result = await query(
      'INSERT INTO comment (content, "postId", "authorId", "parentId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
      [content, postId, authorId, parentId || null]
    );

    // Get the created comment with user info
    const comment = await queryOne(`
      SELECT 
        c.id, c.content, c."createdAt", c."parentId",
        u.id as "authorId", u.name as "authorName", u.username as "authorUsername",
        pr."profilePictureUrl" as "authorProfilePicture"
      FROM comment c
      LEFT JOIN "user" u ON c."authorId" = u.id
      LEFT JOIN profile pr ON u.id = pr."userId"
      WHERE c.id = $1
    `, [result.rows[0].id]);

    res.status(201).json({
      status: 'success',
      message: 'Comment added successfully',
      payload: comment
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add comment'
    });
  }
});

// Like/unlike a comment
router.post('/likeComment', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.body;
    const userId = req.user.id;

    // Check if already liked
    const existingLike = await queryOne(
      'SELECT id FROM "like" WHERE "commentId" = $1 AND "userId" = $2',
      [commentId, userId]
    );

    if (existingLike) {
      // Unlike
      await query('DELETE FROM "like" WHERE id = $1', [existingLike.id]);
      res.json({
        status: 'success',
        message: 'Comment unliked',
        payload: { liked: false }
      });
    } else {
      // Like
      await query(
        'INSERT INTO "like" ("commentId", "userId", "createdAt", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [commentId, userId]
      );
      res.json({
        status: 'success',
        message: 'Comment liked',
        payload: { liked: true }
      });
    }

  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to like/unlike comment'
    });
  }
});

// Delete a comment
router.post('/deleteComment', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.body;
    const userId = req.user.id;

    // Check if user owns the comment
    const comment = await queryOne(
      'SELECT id, "authorId" FROM comment WHERE id = $1',
      [commentId]
    );

    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    if (comment.authorId !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized to delete this comment'
      });
    }

    // Delete comment
    await query('DELETE FROM comment WHERE id = $1', [commentId]);

    res.json({
      status: 'success',
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete comment'
    });
  }
});

// Get saved posts
router.get('/getSavedPosts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const savedPosts = await query(`
      SELECT 
        p.id, p.title, p.content, p."createdAt", p."updatedAt",
        u.id as "authorId", u.name as "authorName", u.username as "authorUsername",
        pr."profilePictureUrl" as "authorProfilePicture",
        STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls",
        s."createdAt" as "savedAt"
      FROM save s
      LEFT JOIN post p ON s."postId" = p.id
      LEFT JOIN "user" u ON p."authorId" = u.id
      LEFT JOIN profile pr ON u.id = pr."userId"
      LEFT JOIN media m ON p.id = m."postId"
      WHERE s."userId" = $1 AND p.published = true
      GROUP BY p.id, u.id, pr."profilePictureUrl", s."createdAt"
      ORDER BY s."createdAt" DESC
    `, [userId]);

    const processedPosts = savedPosts.map(post => ({
      ...post,
      mediaUrls: post.mediaUrls ? post.mediaUrls.split(',') : []
    }));

    res.json({
      status: 'success',
      payload: processedPosts
    });

  } catch (error) {
    console.error('Get saved posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch saved posts'
    });
  }
});

// Get liked posts
router.get('/getLikedPosts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const likedPosts = await query(`
      SELECT 
        p.id, p.title, p.content, p."createdAt", p."updatedAt",
        u.id as "authorId", u.name as "authorName", u.username as "authorUsername",
        pr."profilePictureUrl" as "authorProfilePicture",
        STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls",
        l."createdAt" as "likedAt"
      FROM "like" l
      LEFT JOIN post p ON l."postId" = p.id
      LEFT JOIN "user" u ON p."authorId" = u.id
      LEFT JOIN profile pr ON u.id = pr."userId"
      LEFT JOIN media m ON p.id = m."postId"
      WHERE l."userId" = $1 AND p.published = true
      GROUP BY p.id, u.id, pr."profilePictureUrl", l."createdAt"
      ORDER BY l."createdAt" DESC
    `, [userId]);

    const processedPosts = likedPosts.map(post => ({
      ...post,
      mediaUrls: post.mediaUrls ? post.mediaUrls.split(',') : []
    }));

    res.json({
      status: 'success',
      payload: processedPosts
    });

  } catch (error) {
    console.error('Get liked posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch liked posts'
    });
  }
});

// Search posts
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { query: searchQuery } = req.query;
    const userId = req.user?.id || null;

    if (!searchQuery) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query is required'
      });
    }

    const posts = await query(`
      SELECT 
        p.id, p.title, p.content, p."createdAt", p."updatedAt",
        u.id as "authorId", u.name as "authorName", u.username as "authorUsername",
        pr."profilePictureUrl" as "authorProfilePicture",
        STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls",
        COUNT(DISTINCT l.id) as "likesCount",
        COUNT(DISTINCT c.id) as "commentsCount",
        ${userId ? 'MAX(CASE WHEN l."userId" = $1 THEN 1 ELSE 0 END)' : '0'} as "isLiked",
        ${userId ? 'MAX(CASE WHEN s."userId" = $2 THEN 1 ELSE 0 END)' : '0'} as "isSaved"
      FROM post p
      LEFT JOIN "user" u ON p."authorId" = u.id
      LEFT JOIN profile pr ON u.id = pr."userId"
      LEFT JOIN media m ON p.id = m."postId"
      LEFT JOIN "like" l ON p.id = l."postId"
      LEFT JOIN comment c ON p.id = c."postId"
      LEFT JOIN save s ON p.id = s."postId"
      WHERE p.published = true AND (
        p.title ILIKE $${userId ? '3' : '1'} OR 
        p.content ILIKE $${userId ? '4' : '2'} OR 
        u.name ILIKE $${userId ? '5' : '3'} OR 
        u.username ILIKE $${userId ? '6' : '4'}
      )
      GROUP BY p.id, u.id, pr."profilePictureUrl"
      ORDER BY p."createdAt" DESC
      LIMIT 50
    `, userId ? 
      [userId, userId, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`] : 
      [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`]
    );

    const processedPosts = posts.map(post => ({
      ...post,
      mediaUrls: post.mediaUrls ? post.mediaUrls.split(',') : [],
      isLiked: Boolean(post.isLiked),
      isSaved: Boolean(post.isSaved)
    }));

    res.json({
      status: 'success',
      payload: processedPosts
    });

  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search posts'
    });
  }
});

// Get trending posts for explore page
router.get('/trending', optionalAuth, async (req, res) => {
  try {
    const currentUserId = req.user?.id || null;
    
    const posts = await query(`
      SELECT 
        p.id,
        p.title,
        p.content,
        p."createdAt",
        p."updatedAt",
        p."authorId",
        u.name as "authorName",
        u.username as "authorUsername",
        pr."profilePictureUrl" as "authorProfilePicture",
        STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls",
        COUNT(DISTINCT l.id) as "likesCount",
        COUNT(DISTINCT c.id) as "commentsCount",
        ${currentUserId ? 'MAX(CASE WHEN l."userId" = $1 THEN 1 ELSE 0 END)' : '0'} as "isLiked",
        ${currentUserId ? 'MAX(CASE WHEN s."userId" = $2 THEN 1 ELSE 0 END)' : '0'} as "isSaved"
      FROM post p
      LEFT JOIN "user" u ON p."authorId" = u.id
      LEFT JOIN profile pr ON u.id = pr."userId"
      LEFT JOIN media m ON p.id = m."postId"
      LEFT JOIN "like" l ON p.id = l."postId"
      LEFT JOIN comment c ON p.id = c."postId"
      LEFT JOIN save s ON p.id = s."postId"
      WHERE p."createdAt" >= CURRENT_DATE - INTERVAL '7 days' AND p.published = true
      GROUP BY p.id, p.title, p.content, p."createdAt", p."updatedAt", p."authorId", u.name, u.username, pr."profilePictureUrl"
      ORDER BY (COUNT(DISTINCT l.id) * 2 + COUNT(DISTINCT c.id)) DESC, p."createdAt" DESC
      LIMIT 20
    `, currentUserId ? [currentUserId, currentUserId] : []);

    const processedPosts = posts.map(post => ({
      ...post,
      mediaUrls: post.mediaUrls ? post.mediaUrls.split(',') : [],
      isLiked: Boolean(post.isLiked),
      isSaved: Boolean(post.isSaved)
    }));

    res.json({
      status: 'success',
      payload: processedPosts
    });

  } catch (error) {
    console.error('Get trending posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get trending posts'
    });
  }
});

module.exports = router;

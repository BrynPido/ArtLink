const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, queryOne, transaction } = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateListing, handleValidationErrors } = require('../middleware/validation');
const storageService = require('../services/supabase-storage');

const router = express.Router();

// Configure multer for memory storage (we'll upload to Supabase)
const storage = multer.memoryStorage();

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

// Create a new listing
router.post('/create', authenticateToken, upload.array('media', 10), validateListing, handleValidationErrors, async (req, res) => {
  try {
    const { title, content, listingDetails } = req.body;
    const authorId = req.user.id;
    const files = req.files || [];

    console.log('🔍 Creating listing with files:', files.length);

    // Parse listingDetails if it's a string
    const details = typeof listingDetails === 'string' ? JSON.parse(listingDetails) : listingDetails;

    const result = await transaction(async (connection) => {
      // Insert listing
      const listingResult = await connection.query(
        'INSERT INTO listing (title, content, "authorId", published, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
        [title, content || '', authorId, true]
      );

      const listingId = listingResult.rows[0].id;

      // Insert listing details
      await connection.query(
        'INSERT INTO listing_details ("listingId", price, category, "condition", location, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [listingId, details.price, details.category, details.condition, details.location]
      );

      // Upload files to Supabase and insert media records
      if (files.length > 0) {
        for (const file of files) {
          console.log('🔍 Uploading listing file to Supabase:', file.originalname);
          
          const uploadResult = await storageService.uploadFile(
            file.buffer,
            file.originalname,
            'listings',
            file.mimetype
          );

          await connection.query(
            'INSERT INTO media ("listingId", "mediaUrl", "mediaType", "createdAt", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [listingId, uploadResult.url, file.mimetype]
          );

          console.log('✅ Listing file uploaded and media record created:', uploadResult.url);
        }
      }

      return listingId;
    });

    res.status(201).json({
      status: 'success',
      message: 'Listing created successfully',
      payload: { listingId: result }
    });

  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create listing'
    });
  }
});

// Get all listings (with pagination and filters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { category, minPrice, maxPrice, condition, location, myListings } = req.query;

    let whereClause = 'WHERE l.published = true';
    let params = [];
    let paramCounter = 1;

    // Filter for current user's listings
    if (myListings === 'true' && req.user) {
      whereClause += ` AND l."authorId" = $${paramCounter}`;
      params.push(req.user.id);
      paramCounter++;
    }

    // Add other filters
    if (category) {
      whereClause += ` AND ld.category = $${paramCounter}`;
      params.push(category);
      paramCounter++;
    }
    if (minPrice) {
      whereClause += ` AND ld.price >= $${paramCounter}`;
      params.push(parseFloat(minPrice));
      paramCounter++;
    }
    if (maxPrice) {
      whereClause += ` AND ld.price <= $${paramCounter}`;
      params.push(parseFloat(maxPrice));
      paramCounter++;
    }
    if (condition) {
      whereClause += ` AND ld."condition" = $${paramCounter}`;
      params.push(condition);
      paramCounter++;
    }
    if (location) {
      whereClause += ` AND ld.location ILIKE $${paramCounter}`;
      params.push(`%${location}%`);
      paramCounter++;
    }

    const listings = await query(`
      SELECT 
        l.id, l.title, l.content, l."createdAt", l."updatedAt", l.status,
        u.id as "authorId", u.name as "authorName", u.username as "authorUsername",
        pr."profilePictureUrl" as "authorProfilePicture",
        ld.price, ld.category, ld."condition", ld.location,
        STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls"
      FROM listing l
      LEFT JOIN "user" u ON l."authorId" = u.id
      LEFT JOIN profile pr ON u.id = pr."userId"
      LEFT JOIN listing_details ld ON l.id = ld."listingId"
      LEFT JOIN media m ON l.id = m."listingId"
      ${whereClause}
      GROUP BY l.id, u.id, pr."profilePictureUrl", ld.id
      ORDER BY l."createdAt" DESC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `, [...params, limit, offset]);

    const processedListings = listings.map(listing => ({
      ...listing,
      mediaUrls: listing.mediaUrls ? listing.mediaUrls.split(',') : [],
      price: parseFloat(listing.price)
    }));

    res.json({
      status: 'success',
      payload: {
        listings: processedListings,
        pagination: {
          page,
          limit,
          hasMore: listings.length === limit
        }
      }
    });

  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch listings'
    });
  }
});

// Get transactions for a user (seller or buyer)
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query; // 'seller' or 'buyer' or both

    let results = [];

    if (type === 'seller' || !type) {
      // Get actual transactions where user is seller
      const transactions = await query(`
        SELECT 
          lt.*,
          l.title as listing_title,
          l.content as listing_content,
          seller.name as seller_name,
          seller.username as seller_username,
          buyer.name as buyer_name,
          buyer.username as buyer_username,
          m."mediaUrl" as listing_image,
          'transaction' as source_type
        FROM listing_transaction lt
        JOIN listing l ON lt.listingid = l.id
        JOIN "user" seller ON lt.sellerid = seller.id
        JOIN "user" buyer ON lt.buyerid = buyer.id
        LEFT JOIN media m ON l.id = m."listingId"
        WHERE lt.sellerid = $1
        ORDER BY lt.createdat DESC
      `, [userId]);

      results = [...results, ...transactions];

      // Also get sold listings without transactions (direct sales)
      const soldListings = await query(`
        SELECT 
          l.id,
          l.id as listingid,
          NULL as buyerid,
          l."authorId" as sellerid,
          NULL as conversationid,
          ld.price as finalprice,
          'completed' as status,
          NULL as notes,
          l."updatedAt" as createdat,
          NULL as completedat,
          l.title as listing_title,
          l.content as listing_content,
          seller.name as seller_name,
          seller.username as seller_username,
          'Unknown Buyer' as buyer_name,
          'unknown' as buyer_username,
          m."mediaUrl" as listing_image,
          'sold_listing' as source_type
        FROM listing l
        JOIN "user" seller ON l."authorId" = seller.id
        LEFT JOIN listing_details ld ON l.id = ld."listingId"
        LEFT JOIN media m ON l.id = m."listingId"
        WHERE l."authorId" = $1 
        AND l.status = 'sold'
        AND l.id NOT IN (
          SELECT DISTINCT listingid FROM listing_transaction WHERE sellerid = $1
        )
        ORDER BY l."updatedAt" DESC
      `, [userId]);

      results = [...results, ...soldListings];
    }

    if (type === 'buyer') {
      // Get transactions where user is buyer
      const buyerTransactions = await query(`
        SELECT 
          lt.*,
          l.title as listing_title,
          l.content as listing_content,
          seller.name as seller_name,
          seller.username as seller_username,
          buyer.name as buyer_name,
          buyer.username as buyer_username,
          m."mediaUrl" as listing_image,
          'transaction' as source_type
        FROM listing_transaction lt
        JOIN listing l ON lt.listingid = l.id
        JOIN "user" seller ON lt.sellerid = seller.id
        JOIN "user" buyer ON lt.buyerid = buyer.id
        LEFT JOIN media m ON l.id = m."listingId"
        WHERE lt.buyerid = $1
        ORDER BY lt.createdat DESC
      `, [userId]);

      results = buyerTransactions;
    }

    if (!type) {
      // Get all transactions for user (both as seller and buyer)
      const allTransactions = await query(`
        SELECT 
          lt.*,
          l.title as listing_title,
          l.content as listing_content,
          seller.name as seller_name,
          seller.username as seller_username,
          buyer.name as buyer_name,
          buyer.username as buyer_username,
          m."mediaUrl" as listing_image,
          'transaction' as source_type
        FROM listing_transaction lt
        JOIN listing l ON lt.listingid = l.id
        JOIN "user" seller ON lt.sellerid = seller.id
        JOIN "user" buyer ON lt.buyerid = buyer.id
        LEFT JOIN media m ON l.id = m."listingId"
        WHERE (lt.sellerid = $1 OR lt.buyerid = $1)
        ORDER BY lt.createdat DESC
      `, [userId]);

      results = [...results, ...allTransactions];
    }

    // Sort all results by date
    results.sort((a, b) => new Date(b.createdat) - new Date(a.createdat));

    res.json({
      status: 'success',
      payload: results
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch transactions'
    });
  }
});

// Get single listing by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const listingId = req.params.id;

    const listing = await queryOne(`
      SELECT 
        l.id, l.title, l.content, l."createdAt", l."updatedAt", l.status,
        u.id as "authorId", u.name as "authorName", u.username as "authorUsername",
        pr."profilePictureUrl" as "authorProfilePicture",
        ld.price, ld.category, ld."condition", ld.location,
        STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls"
      FROM listing l
      LEFT JOIN "user" u ON l."authorId" = u.id
      LEFT JOIN profile pr ON u.id = pr."userId"
      LEFT JOIN listing_details ld ON l.id = ld."listingId"
      LEFT JOIN media m ON l.id = m."listingId"
      WHERE l.id = $1 AND l.published = true
      GROUP BY l.id, u.id, pr."profilePictureUrl", ld.id
    `, [listingId]);

    if (!listing) {
      return res.status(404).json({
        status: 'error',
        message: 'Listing not found'
      });
    }

    const processedListing = {
      ...listing,
      mediaUrls: listing.mediaUrls ? listing.mediaUrls.split(',') : [],
      price: parseFloat(listing.price),
      listingDetails: {
        price: parseFloat(listing.price),
        category: listing.category,
        condition: listing.condition,
        location: listing.location
      }
    };

    res.json({
      status: 'success',
      payload: processedListing
    });

  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch listing'
    });
  }
});

// Get listings for a specific user
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const userId = req.params.userId;

    const listings = await query(`
      SELECT 
        l.id, l.title, l.content, l."createdAt", l."updatedAt",
        ld.price, ld.category, ld.condition, ld.location,
        STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls"
      FROM listing l
      LEFT JOIN listing_details ld ON l.id = ld."listingId"
      LEFT JOIN media m ON l.id = m."listingId"
      WHERE l."authorId" = $1 AND l.published = true
      GROUP BY l.id, ld.id
      ORDER BY l."createdAt" DESC
    `, [userId]);

    const processedListings = listings.map(listing => ({
      ...listing,
      mediaUrls: listing.mediaUrls ? listing.mediaUrls.split(',') : [],
      price: parseFloat(listing.price)
    }));

    res.json({
      status: 'success',
      payload: processedListings
    });

  } catch (error) {
    console.error('Get user listings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user listings'
    });
  }
});

// Update a listing
router.post('/:id/update', authenticateToken, upload.array('media', 10), validateListing, handleValidationErrors, async (req, res) => {
  try {
    const listingId = req.params.id;
    const { title, content, listingDetails } = req.body;
    const userId = req.user.id;
    const files = req.files || [];

    // Check if user owns the listing
    const listing = await queryOne(
      'SELECT id, "authorId" FROM listing WHERE id = $1',
      [listingId]
    );

    if (!listing) {
      return res.status(404).json({
        status: 'error',
        message: 'Listing not found'
      });
    }

    if (listing.authorId !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized to update this listing'
      });
    }

    // Parse listingDetails if it's a string
    const details = typeof listingDetails === 'string' ? JSON.parse(listingDetails) : listingDetails;

    await transaction(async (connection) => {
      // Update listing
      await connection.execute(
        'UPDATE listing SET title = $1, content = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3',
        [title, content || '', listingId]
      );

      // Update listing details
      await connection.execute(
        'UPDATE listing_details SET price = $1, category = $2, condition = $3, location = $4, "updatedAt" = CURRENT_TIMESTAMP WHERE "listingId" = $5',
        [details.price, details.category, details.condition, details.location, listingId]
      );

      // Add new media if files were uploaded
      if (files.length > 0) {
        for (const file of files) {
          await connection.execute(
            'INSERT INTO media ("listingId", "mediaUrl", "mediaType", "createdAt", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [listingId, `/uploads/listings/${file.filename}`, file.mimetype]
          );
        }
      }
    });

    res.json({
      status: 'success',
      message: 'Listing updated successfully'
    });

  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update listing'
    });
  }
});

// Delete a listing
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const listingId = req.params.id;
    const userId = req.user.id;

    // Check if user owns the listing
    const listing = await queryOne(
      'SELECT id, "authorId" FROM listing WHERE id = $1',
      [listingId]
    );

    if (!listing) {
      return res.status(404).json({
        status: 'error',
        message: 'Listing not found'
      });
    }

    if (listing.authorId !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized to delete this listing'
      });
    }

    // Delete listing (CASCADE will handle related records)
    await query('DELETE FROM listing WHERE id = $1', [listingId]);

    res.json({
      status: 'success',
      message: 'Listing deleted successfully'
    });

  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete listing'
    });
  }
});

// Search listings
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { query: searchQuery } = req.query;

    if (!searchQuery) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query is required'
      });
    }

    const listings = await query(`
      SELECT 
        l.id, l.title, l.content, l."createdAt", l."updatedAt",
        u.id as "authorId", u.name as "authorName", u.username as "authorUsername",
        pr."profilePictureUrl" as "authorProfilePicture",
        ld.price, ld.category, ld.condition, ld.location,
        STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls"
      FROM listing l
      LEFT JOIN "user" u ON l."authorId" = u.id
      LEFT JOIN profile pr ON u.id = pr."userId"
      LEFT JOIN listing_details ld ON l.id = ld."listingId"
      LEFT JOIN media m ON l.id = m."listingId"
      WHERE l.published = true AND (
        l.title ILIKE $1 OR 
        l.content ILIKE $2 OR 
        ld.category ILIKE $3 OR
        ld.location ILIKE $4
      )
      GROUP BY l.id, u.id, pr."profilePictureUrl", ld.id
      ORDER BY l."createdAt" DESC
      LIMIT 50
    `, [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`]);

    const processedListings = listings.map(listing => ({
      ...listing,
      mediaUrls: listing.mediaUrls ? listing.mediaUrls.split(',') : [],
      price: parseFloat(listing.price)
    }));

    res.json({
      status: 'success',
      payload: processedListings
    });

  } catch (error) {
    console.error('Search listings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search listings'
    });
  }
});

// Get listing categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await query(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM listing_details ld
      LEFT JOIN listing l ON ld."listingId" = l.id
      WHERE l.published = true
      GROUP BY category
      ORDER BY count DESC, category ASC
    `);

    res.json({
      status: 'success',
      payload: categories
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch categories'
    });
  }
});

// Mark listing as sold and create transaction record
router.post('/:id/mark-sold', authenticateToken, async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const { buyerId, conversationId, finalPrice } = req.body;
    const sellerId = req.user.id;

    // Verify the user owns this listing
    const listing = await queryOne('SELECT * FROM listing WHERE id = $1 AND "authorId" = $2', [listingId, sellerId]);
    if (!listing) {
      return res.status(404).json({
        status: 'error',
        message: 'Listing not found or you are not the owner'
      });
    }

    const result = await transaction(async (connection) => {
      // Update listing status
      await connection.query(
        'UPDATE listing SET status = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
        ['sold', listingId]
      );

      // Create transaction record only if we have a valid buyer
      let transactionId = null;
      if (buyerId && buyerId > 0) {
        const transactionResult = await connection.query(
          'INSERT INTO listing_transaction (listingid, buyerid, sellerid, conversationid, finalprice, status, createdat) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id',
          [listingId, buyerId, sellerId, conversationId || null, finalPrice, 'completed']
        );
        transactionId = transactionResult.rows[0].id;

        // Create notification for buyer
        await connection.query(
          'INSERT INTO notification (content, type, "recipientId", "senderId", "createdAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)',
          [`Your offer for "${listing.title}" has been accepted! The seller has marked it as sold.`, 'listing_sold', buyerId, sellerId]
        );
      }

      return transactionId;
    });

    res.json({
      status: 'success',
      message: 'Listing marked as sold successfully',
      payload: { 
        transactionId: result,
        hasTransaction: result !== null 
      }
    });

  } catch (error) {
    console.error('Mark as sold error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark listing as sold'
    });
  }
});

// Update listing status (reserve, available, etc.)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    const { status } = req.body;
    const userId = req.user.id;

    // Validate status
    const validStatuses = ['available', 'reserved', 'sold', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Verify the user owns this listing
    const listing = await queryOne('SELECT * FROM listing WHERE id = $1 AND "authorId" = $2', [listingId, userId]);
    if (!listing) {
      return res.status(404).json({
        status: 'error',
        message: 'Listing not found or you are not the owner'
      });
    }

    // Update listing status
    await query(
      'UPDATE listing SET status = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
      [status, listingId]
    );

    res.json({
      status: 'success',
      message: `Listing status updated to ${status} successfully`
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update listing status'
    });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

/**
 * Track a site visit
 * POST /api/analytics/visit
 */
router.post('/visit', async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const referer = req.headers['referer'] || null;

    // Insert visit record
    await query(
      `INSERT INTO site_visits (ip_address, user_agent, referer, visited_at)
       VALUES ($1, $2, $3, NOW())`,
      [ipAddress, userAgent, referer]
    );

    // Get total visit count
    const totalVisits = await query(
      `SELECT COUNT(*) as total FROM site_visits`
    );

    // Get unique visitor count (based on IP address)
    const uniqueVisitors = await query(
      `SELECT COUNT(DISTINCT ip_address) as total FROM site_visits`
    );

    res.json({
      success: true,
      totalVisits: parseInt(totalVisits[0].total),
      uniqueVisitors: parseInt(uniqueVisitors[0].total)
    });
  } catch (error) {
    console.error('Error tracking visit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track visit'
    });
  }
});

/**
 * Get site statistics
 * GET /api/analytics/stats
 */
router.get('/stats', async (req, res) => {
  try {
    // Get total visit count
    const totalVisits = await query(
      `SELECT COUNT(*) as total FROM site_visits`
    );

    // Get unique visitor count (based on IP address)
    const uniqueVisitors = await query(
      `SELECT COUNT(DISTINCT ip_address) as total FROM site_visits`
    );

    // Get visits today
    const visitsToday = await query(
      `SELECT COUNT(*) as total FROM site_visits 
       WHERE DATE(visited_at) = CURRENT_DATE`
    );

    // Get visits this week
    const visitsThisWeek = await query(
      `SELECT COUNT(*) as total FROM site_visits 
       WHERE visited_at >= DATE_TRUNC('week', CURRENT_DATE)`
    );

    // Get visits this month
    const visitsThisMonth = await query(
      `SELECT COUNT(*) as total FROM site_visits 
       WHERE visited_at >= DATE_TRUNC('month', CURRENT_DATE)`
    );

    res.json({
      success: true,
      stats: {
        totalVisits: parseInt(totalVisits[0].total),
        uniqueVisitors: parseInt(uniqueVisitors[0].total),
        visitsToday: parseInt(visitsToday[0].total),
        visitsThisWeek: parseInt(visitsThisWeek[0].total),
        visitsThisMonth: parseInt(visitsThisMonth[0].total)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;

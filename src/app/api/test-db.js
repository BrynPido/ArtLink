const { Client } = require('pg');
require('dotenv').config();

async function testDB() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Check profile table
    const profiles = await client.query('SELECT id, "userId", "profilePictureUrl", bio FROM profile ORDER BY "updatedAt" DESC LIMIT 5');
    console.log('Profiles:', profiles.rows);
    
    // Check recent posts
    const posts = await client.query('SELECT id, title, "authorId", "createdAt" FROM post ORDER BY "createdAt" DESC LIMIT 5');
    console.log('Recent Posts:', posts.rows);
    
    // Check media table
    const media = await client.query('SELECT id, "mediaUrl", "mediaType", "postId", "listingId" FROM media ORDER BY "createdAt" DESC LIMIT 5');
    console.log('Recent Media:', media.rows);
    
    await client.end();
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

testDB();

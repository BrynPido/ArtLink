const { query } = require('./config/database');

async function updateOldUrls() {
  try {
    // Update profile pictures with local paths to null
    const profileResult = await query(`UPDATE profile SET "profilePictureUrl" = null WHERE "profilePictureUrl" LIKE '/uploads/%'`);
    console.log('Updated profile pictures with old URLs');
    
    // Delete media records with local paths (they're broken anyway)
    const mediaResult = await query(`DELETE FROM media WHERE "mediaUrl" LIKE '/uploads/%'`);
    console.log('Deleted media records with old URLs');
    
    console.log('✅ Database cleanup completed');
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

updateOldUrls();

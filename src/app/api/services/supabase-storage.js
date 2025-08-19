const { createClient } = require('@supabase/supabase-js');
const AWS = require('aws-sdk');
const path = require('path');

// Load environment variables
require('dotenv').config();

class SupabaseStorageService {
  constructor() {
    // Initialize Supabase client
    this.supabaseUrl = `https://janjfnnvvnnylruflpzo.supabase.co`;
    this.supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    // For now, we'll use the S3-compatible API directly
    this.s3 = new AWS.S3({
      endpoint: process.env.ENDPOINT,
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.ACCESS_SECRET,
      region: process.env.EP_REGION,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      maxRetries: 3,
      httpOptions: {
        timeout: 60000
      }
    });
    
    this.bucketName = 'Media'; // Your bucket name from Supabase
  }

  /**
   * Upload a file to Supabase storage
   * @param {Buffer} fileBuffer - The file buffer
   * @param {string} fileName - The file name
   * @param {string} folder - The folder path (e.g., 'profiles', 'listings', 'posts')
   * @param {string} mimeType - The MIME type of the file
   * @returns {Promise<string>} - The public URL of the uploaded file
   */
  async uploadFile(fileBuffer, fileName, folder = '', mimeType = 'image/jpeg') {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.round(Math.random() * 1E9);
      const fileExtension = path.extname(fileName);
      const uniqueFileName = `${timestamp}-${randomId}${fileExtension}`;
      
      // Create the full path
      const filePath = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;
      
      console.log(`🔍 Uploading file to Supabase storage: ${filePath}`);
      
      const uploadParams = {
        Bucket: this.bucketName,
        Key: filePath,
        Body: fileBuffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000', // 1 year cache
      };

      const result = await this.s3.upload(uploadParams).promise();
      
      // Generate public URL - Correct Supabase Storage public URL format
      const publicUrl = `https://janjfnnvvnnylruflpzo.supabase.co/storage/v1/object/public/${this.bucketName}/${filePath}`;
      
      console.log(`✅ File uploaded successfully: ${publicUrl}`);
      
      return {
        success: true,
        url: publicUrl,
        path: filePath,
        fileName: uniqueFileName
      };
      
    } catch (error) {
      console.error('❌ Error uploading file to Supabase storage:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Delete a file from Supabase storage
   * @param {string} filePath - The file path in storage
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(filePath) {
    try {
      console.log(`🔍 Deleting file from Supabase storage: ${filePath}`);
      
      const deleteParams = {
        Bucket: this.bucketName,
        Key: filePath
      };

      await this.s3.deleteObject(deleteParams).promise();
      console.log(`✅ File deleted successfully: ${filePath}`);
      
      return true;
    } catch (error) {
      console.error('❌ Error deleting file from Supabase storage:', error);
      return false;
    }
  }

  /**
   * Get a signed URL for private file access
   * @param {string} filePath - The file path in storage
   * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} - The signed URL
   */
  async getSignedUrl(filePath, expiresIn = 3600) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: filePath,
        Expires: expiresIn
      };

      const signedUrl = await this.s3.getSignedUrlPromise('getObject', params);
      return signedUrl;
    } catch (error) {
      console.error('❌ Error generating signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Get public URL for a file
   * @param {string} filePath - The file path in storage
   * @returns {string} - The public URL
   */
  getPublicUrl(filePath) {
    return `${process.env.ENDPOINT.replace('/storage/v1/s3', '')}/storage/v1/object/public/${this.bucketName}/${filePath}`;
  }
}

module.exports = new SupabaseStorageService();

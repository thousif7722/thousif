'use strict';
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../utils/logger');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

const BUCKET = process.env.AWS_S3_BUCKET || 'servicehub-dev';

/**
 * Extract the S3 object key from a stored URL.
 * Handles both real AWS URLs and dev-mock URLs.
 *   Real: https://bucket.s3.region.amazonaws.com/kyc/...  → "kyc/..."
 *   Dev:  https://dev-s3.servicehub.in/kyc/...            → "kyc/..."
 */
function extractKeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    // pathname starts with "/" — strip it
    return parsed.pathname.slice(1) || null;
  } catch {
    return null;
  }
}

const s3Service = {
  async upload(key, body, contentType = 'application/octet-stream') {
    const hasRealAwsKeys = process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID.includes('EXAMPLE');
    if (!hasRealAwsKeys && process.env.NODE_ENV === 'development') {
      logger.debug(`[DEV S3 Mock] Upload: ${key} (${contentType})`);
      return `https://dev-s3.servicehub.in/${key}`;
    }
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    }));
    return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
  },

  async getSignedUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3Client, command, { expiresIn });
  },

  /**
   * Generate a fresh signed URL from a stored S3 URL (handles dev-mock gracefully).
   * @param {string} storedUrl - The full URL stored in the DB
   * @param {number} expiresIn - Seconds until the signed URL expires (default 1 hour)
   * @returns {Promise<string>} Fresh signed URL, or original URL if dev-mock
   */
  async getSignedUrlFromStoredUrl(storedUrl, expiresIn = 3600) {
    if (!storedUrl) return null;
    const isDev = storedUrl.includes('dev-s3.servicehub.in');
    if (isDev) {
      // In development, the bucket is public/mock — return as-is
      return storedUrl;
    }
    const key = extractKeyFromUrl(storedUrl);
    if (!key) return storedUrl;
    return this.getSignedUrl(key, expiresIn);
  },

  async delete(key) {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  },
};

module.exports = { s3Service, extractKeyFromUrl };

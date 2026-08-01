'use strict';
const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient = null;
let redisSubscriber = null;

// In-memory cache fallback when Redis is unavailable
const memoryCache = new Map();
const memoryExpirations = new Map();

function cleanExpired(key) {
  if (memoryExpirations.has(key) && memoryExpirations.get(key) < Date.now()) {
    memoryCache.delete(key);
    memoryExpirations.delete(key);
  }
}

/**
 * Configure and connect Redis client & subscriber for AWS ElastiCache Serverless & standard Redis.
 * Reads Redis connection strictly from process.env.REDIS_URL.
 */
async function connectRedis() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn('⚠️ REDIS_URL environment variable is not set. Operating in graceful in-memory fallback mode.');
    redisClient = null;
    redisSubscriber = null;
    return null;
  }

  const isTls = redisUrl.startsWith('rediss://');
  let hostname;
  try {
    hostname = new URL(redisUrl).hostname;
  } catch {}

  const clientOptions = {
    url: redisUrl,
    socket: {
      connectTimeout: 10000, // 10s connection timeout
      keepAlive: 5000,       // Keep TCP connection alive for AWS ElastiCache
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis: Maximum reconnect attempts reached.');
          return new Error('Max reconnect retries reached');
        }
        const delay = Math.min(retries * 500, 5000);
        logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
      ...(isTls && {
        tls: true,
        servername: hostname,
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      }),
    },
  };

  try {
    redisClient = createClient(clientOptions);
    redisSubscriber = createClient(clientOptions);

    redisClient.on('ready', () => logger.info('✅ Redis client ready'));
    redisClient.on('connect', () => logger.info('⚡ Redis client connecting...'));
    redisClient.on('reconnecting', () => logger.warn('🔄 Redis client reconnecting...'));
    redisClient.on('error', (err) => logger.error('❌ Redis client error:', err.message));

    redisSubscriber.on('ready', () => logger.info('✅ Redis subscriber ready'));
    redisSubscriber.on('connect', () => logger.info('⚡ Redis subscriber connecting...'));
    redisSubscriber.on('reconnecting', () => logger.warn('🔄 Redis subscriber reconnecting...'));
    redisSubscriber.on('error', (err) => logger.error('❌ Redis subscriber error:', err.message));

    await Promise.all([redisClient.connect(), redisSubscriber.connect()]);
    return redisClient;
  } catch (error) {
    logger.warn('⚠️ Redis connection failed. Operating in graceful in-memory fallback mode.', error.message);
    try { if (redisClient?.isOpen) await redisClient.quit(); } catch {}
    try { if (redisSubscriber?.isOpen) await redisSubscriber.quit(); } catch {}
    redisClient = null;
    redisSubscriber = null;
    return null;
  }
}

function getRedisClient() {
  if (!redisClient?.isReady) {
    return null;
  }
  return redisClient;
}

function getRedisSubscriber() {
  if (!redisSubscriber?.isReady) {
    return null;
  }
  return redisSubscriber;
}

// ── Cache Helpers ──────────────────────────────────────────────────────────────
const cache = {
  async get(key) {
    try {
      const client = getRedisClient();
      if (!client) {
        cleanExpired(key);
        const data = memoryCache.get(key);
        return data !== undefined ? JSON.parse(data) : null;
      }
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error('Redis GET error:', err.message);
      cleanExpired(key);
      const data = memoryCache.get(key);
      return data !== undefined ? JSON.parse(data) : null;
    }
  },

  async set(key, value, ttlSeconds = 300) {
    try {
      const client = getRedisClient();
      if (!client) {
        memoryCache.set(key, JSON.stringify(value));
        if (ttlSeconds > 0) {
          memoryExpirations.set(key, Date.now() + ttlSeconds * 1000);
        }
        return true;
      }
      await client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (err) {
      logger.error('Redis SET error:', err.message);
      memoryCache.set(key, JSON.stringify(value));
      if (ttlSeconds > 0) {
        memoryExpirations.set(key, Date.now() + ttlSeconds * 1000);
      }
      return false;
    }
  },

  async del(key) {
    try {
      const client = getRedisClient();
      if (!client) {
        memoryCache.delete(key);
        memoryExpirations.delete(key);
        return true;
      }
      await client.del(key);
      return true;
    } catch (err) {
      logger.error('Redis DEL error:', err.message);
      memoryCache.delete(key);
      memoryExpirations.delete(key);
      return false;
    }
  },

  async delPattern(pattern) {
    try {
      const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      for (const key of memoryCache.keys()) {
        if (regexPattern.test(key)) {
          memoryCache.delete(key);
          memoryExpirations.delete(key);
        }
      }

      const client = getRedisClient();
      if (!client) return;

      let cursor = 0;
      const keysToDelete = [];
      do {
        const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = Number(reply.cursor);
        keysToDelete.push(...reply.keys);
      } while (cursor !== 0);

      if (keysToDelete.length > 0) {
        for (let i = 0; i < keysToDelete.length; i += 500) {
          await client.del(keysToDelete.slice(i, i + 500));
        }
      }
    } catch (err) {
      logger.error('Redis DEL pattern error:', err.message);
    }
  },

  async increment(key, ttlSeconds = 900) {
    try {
      const client = getRedisClient();
      if (!client) {
        cleanExpired(key);
        const currentData = memoryCache.get(key);
        let val = currentData !== undefined ? JSON.parse(currentData) : 0;
        val += 1;
        memoryCache.set(key, JSON.stringify(val));
        if (currentData === undefined && ttlSeconds > 0) {
          memoryExpirations.set(key, Date.now() + ttlSeconds * 1000);
        }
        return val;
      }
      const val = await client.incr(key);
      if (val === 1 && ttlSeconds > 0) {
        await client.expire(key, ttlSeconds);
      }
      return val;
    } catch (err) {
      logger.error('Redis INCR error:', err.message);
      cleanExpired(key);
      const currentData = memoryCache.get(key);
      let val = currentData !== undefined ? JSON.parse(currentData) : 0;
      val += 1;
      memoryCache.set(key, JSON.stringify(val));
      if (currentData === undefined && ttlSeconds > 0) {
        memoryExpirations.set(key, Date.now() + ttlSeconds * 1000);
      }
      return val;
    }
  },

  async hSet(key, field, value) {
    try {
      const client = getRedisClient();
      if (!client) {
        let hash = memoryCache.get(key);
        hash = hash !== undefined ? JSON.parse(hash) : {};
        hash[field] = value;
        memoryCache.set(key, JSON.stringify(hash));
        return true;
      }
      await client.hSet(key, field, JSON.stringify(value));
      return true;
    } catch (err) {
      logger.error('Redis HSET error:', err.message);
      let hash = memoryCache.get(key);
      hash = hash !== undefined ? JSON.parse(hash) : {};
      hash[field] = value;
      memoryCache.set(key, JSON.stringify(hash));
      return false;
    }
  },

  async hGet(key, field) {
    try {
      const client = getRedisClient();
      if (!client) {
        const hash = memoryCache.get(key);
        if (hash === undefined) return null;
        const parsed = JSON.parse(hash);
        return parsed[field] !== undefined ? parsed[field] : null;
      }
      const data = await client.hGet(key, field);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error('Redis HGET error:', err.message);
      const hash = memoryCache.get(key);
      if (hash === undefined) return null;
      const parsed = JSON.parse(hash);
      return parsed[field] !== undefined ? parsed[field] : null;
    }
  },

  async setNX(key, value, ttlSeconds) {
    try {
      const client = getRedisClient();
      if (!client) {
        cleanExpired(key);
        if (memoryCache.has(key)) return false;
        memoryCache.set(key, JSON.stringify(value));
        if (ttlSeconds > 0) {
          memoryExpirations.set(key, Date.now() + ttlSeconds * 1000);
        }
        return true;
      }
      const result = await client.set(key, JSON.stringify(value), {
        NX: true,
        EX: ttlSeconds,
      });
      return result === 'OK';
    } catch (err) {
      logger.error('Redis SETNX error:', err.message);
      cleanExpired(key);
      if (memoryCache.has(key)) return false;
      memoryCache.set(key, JSON.stringify(value));
      if (ttlSeconds > 0) {
        memoryExpirations.set(key, Date.now() + ttlSeconds * 1000);
      }
      return false;
    }
  },
};

// ── Session Store ──────────────────────────────────────────────────────────────
const session = {
  async save(sessionId, data, ttl = 86400) {
    await cache.set(`session:${sessionId}`, data, ttl);
  },
  async get(sessionId) {
    return cache.get(`session:${sessionId}`);
  },
  async destroy(sessionId) {
    await cache.del(`session:${sessionId}`);
  },
};

module.exports = {
  connectRedis,
  getRedisClient,
  getRedisSubscriber,
  cache,
  session,
};

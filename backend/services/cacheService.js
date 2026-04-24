const Redis = require('ioredis');

let client = null;

if (process.env.REDIS_URL) {
  client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null; // stop retrying after 3 attempts
      return Math.min(times * 200, 1000);
    }
  });

  client.on('connect', () => console.log('✅ Redis Cloud connected'));
  client.on('error', (err) => console.error('❌ Redis error:', err.message));
} else {
  console.warn('⚠️  REDIS_URL not set — cache disabled, running without Redis');
}

async function get(key) {
  if (!client) return null;
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.error('Cache get error:', err.message);
    return null;
  }
}

async function set(key, value, ttlSeconds = 3600) {
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error('Cache set error:', err.message);
  }
}

async function del(key) {
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    console.error('Cache del error:', err.message);
  }
}

module.exports = { get, set, del };
// src/utils/redisTest.ts
const Redis = require('ioredis');

async function testRedisConnection(): Promise<void> {
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });

  try {
    // Test connection
    await redis.ping();
    console.log('Successfully connected to Redis!');

    // Test setting and getting a value
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    console.log('Test value retrieved:', value);

    // Clean up
    await redis.del('test-key');
    
    // Close connection
    await redis.quit();
    console.log('Redis connection closed successfully');
    
    // Exit process
    process.exit(0);
  } catch (error) {
    console.error('Redis connection test failed:', error);
    process.exit(1);
  }
}

// Add error handler for unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// Run the test
console.log('Starting Redis connection test...');
testRedisConnection();
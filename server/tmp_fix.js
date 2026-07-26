require('dotenv').config();
const { MongoClient } = require('mongodb');

async function fix() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/servicehub';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const result = await db.collection('users').updateOne(
      { phone: '9999999999' },
      { $set: { role: 'admin', email: 'admin@servicehub.in', permissions: ['manage_providers', 'manage_users', 'manage_jobs', 'manage_financials', 'manage_content'] } }
    );
    console.log('Update result:', result);
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

fix();

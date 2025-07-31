import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'talkpilot';

if (!uri) throw new Error('MONGODB_URI not set in environment');

let cachedClient = global._mongoClient;
let cachedDb = global._mongoDb;

export async function getDb() {
  if (cachedDb && cachedClient) {
    return cachedDb;
  }
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db(dbName);
  global._mongoClient = client;
  global._mongoDb = db;
  return db;
}
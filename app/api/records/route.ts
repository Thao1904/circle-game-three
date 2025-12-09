// app/api/records/route.ts
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://tranconghieu0301_db_user:circlegame1@cluster0.uspwz1b.mongodb.net/';
const MONGO_DB = process.env.MONGO_DB || 'circle-game';
let mongoClient: MongoClient;

async function getMongoClient() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
  }
  return mongoClient;
}

export async function GET() {
  try {
    const client = await getMongoClient();
    const db = client.db(MONGO_DB);
    const collection = db.collection('records');
    const rows = await collection.find({}, { projection: { url: 1, createdAt: 1 } }).sort({ createdAt: 1 }).toArray();
    const result = rows.map(r => ({ id: r._id.toString(), url: r.url, createdAt: r.createdAt }));
    return NextResponse.json({ success: true, records: result });
  } catch (err) {
    console.error('Error fetching records', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

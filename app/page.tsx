export const dynamic = "force-dynamic";

import { MongoClient } from 'mongodb';
import PlayAllRecords from '@/app/components/PlayAllRecords';

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

export default async function Page() {
  // Aggregated records page: always show the newest record (most recent createdAt).
  let record: any = null;

  try {
    const client = await getMongoClient();
    const db = client.db(MONGO_DB);
    const collection = db.collection('records');
    // Find the newest record by createdAt descending
    record = await collection.findOne({}, { sort: { createdAt: -1 } });
  } catch (err) {
    console.error('Error fetching record', err);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Listen to the newest recording</h1>
        {!record || !record.url ? (
          <p className="text-gray-600">Recording not found.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <audio src={record.url} controls className="w-full" />
            <p className="text-sm text-gray-500">Uploaded at: {record.createdAt ? new Date(record.createdAt).toLocaleString() : 'unknown'}</p>

            <PlayAllRecords />
          </div>
        )}
      </div>
    </main>
  );
}

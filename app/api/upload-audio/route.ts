// app/api/upload-audio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { MongoClient } from 'mongodb';


// MongoDB config
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

export async function POST(req: NextRequest) {
  // Parse multipart form data using the Web FormData API provided by NextRequest
  const formData = await req.formData();

  const fileField = formData.get('file');
  if (!fileField) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
  }

  // `fileField` is a File/Blob-like object in the Web FormData API
  const webFile = fileField as unknown as File;
  const arrayBuffer = await webFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const originalFilename = (webFile as any).name || `audio_${Date.now()}.webm`;
  const mimeType = (webFile as any).type || 'audio/webm';
  try {
    // 3️⃣ Khởi tạo Google Cloud Storage
    const keyFile = path.join(process.cwd(), 'google_cloud_key.json'); // File JSON Google Cloud
    const bucketName = 'circle-game-cloud'; // Tên bucket
    const storage = new Storage({ keyFilename: keyFile });
    const bucket = storage.bucket(bucketName);

  // 4️⃣ Upload file
  console.log('Uploading to GCS:', originalFilename, 'mime:', mimeType, 'buffer length:', buffer.length);
    const blob = bucket.file(originalFilename);
    const stream = blob.createWriteStream({
      resumable: false,
      contentType: mimeType,
    });

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
      stream.end(buffer);
    });

    // 5️⃣ Tạo public URL
    await blob.makePublic();
    // encode name to avoid spaces/special char issues in URL
    const encodedName = encodeURIComponent(blob.name);
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${encodedName}`;

    // read metadata for debugging
    let metadata: any = null;
    try {
      const [meta] = await blob.getMetadata();
      metadata = meta;
      console.log('GCS metadata:', { name: blob.name, size: meta.size, contentType: meta.contentType });
    } catch (e) {
      console.warn('Could not read blob metadata', e);
    }

    // 6️⃣ Lưu URL vào MongoDB
    const client = await getMongoClient();
    const db = client.db(MONGO_DB);
  const collection = db.collection('records'); // collection tên 'records'
  const insertResult = await collection.insertOne({ url: publicUrl, createdAt: new Date() });

  // Trả về id của record vừa lưu
  const insertedId = insertResult.insertedId;
  return NextResponse.json({ success: true, url: publicUrl, id: insertedId.toString(), blobName: blob.name, metadata });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

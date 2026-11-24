// Run: node scripts/check-onboardings.js
// Shows which database this app uses and where an "onboardings" collection exists on the cluster.
import 'dotenv/config';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI, process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : undefined);
console.log('This app is connected to DB:', mongoose.connection.name);

const client = mongoose.connection.getClient();
const { databases } = await client.db().admin().listDatabases();
for (const d of databases) {
  const col = client.db(d.name).collection('onboardings');
  const exists = (await client.db(d.name).listCollections({ name: 'onboardings' }).toArray()).length;
  if (exists) {
    const n = await col.countDocuments();
    const sample = await col.findOne({}, { projection: { companyName: 1, email: 1, status: 1, createdAt: 1 } });
    console.log(`"onboardings" in DB "${d.name}": ${n} documents`, sample || '');
  }
}
await mongoose.disconnect();

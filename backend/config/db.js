
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : undefined);

    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB Error:', error.message);
    process.exit(1);
  }
};

export default connectDB;

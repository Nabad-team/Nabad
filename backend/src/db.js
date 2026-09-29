const mongoose = require("mongoose");
const fixGoogleIdIndex = require("./migrations/fixGoogleIdIndex");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set. Check your .env file.");
  }
  await mongoose.connect(uri);
  console.log("MongoDB connected:", mongoose.connection.name);
  await fixGoogleIdIndex();
}

module.exports = connectDB;


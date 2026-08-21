import mongoose from "mongoose";

const isDev = process.env.node_env === "development";
const dbStr = isDev
  ? process.env.local_db_string
  : process.env.remote_db_string;

export async function connectMongoDB() {
  try {
    if (!dbStr) throw new Error("Missing required environment variables.");

    await mongoose.connect(dbStr, {
      serverSelectionTimeoutMS: isDev ? 5000 : 30000,
    });

    console.log("MongoDB connected successfully! 🥰");

    mongoose.connection.on("error", (err) =>
      console.error("MongoDB connection error:", err),
    );
    mongoose.connection.on("disconnected", () =>
      console.warn("MongoDB Disconnected"),
    );

    await mongoose.connect(dbStr);
  } catch (err) {
    console.error("MonogDB connection failed: ", err.message || "unknown");
    process.exit(1);
  }
}

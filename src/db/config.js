import mongoose from "mongoose";

async function main() {
  try {
    await mongoose.connect("http/172.0.0.1:27017/video-editor");
  } catch (e) {
    console.error("Error connection db: ", e);
  }
}

main();

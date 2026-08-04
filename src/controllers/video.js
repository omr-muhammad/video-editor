import crypto from "node:crypto";
import path from "node:path";
import promiseFs from "node:fs/promises";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { VideoValidator } from "../streams/videoValidator.js";
import * as FF from "../lib/ff.js";
import { db } from "../DB.js";

const ALLOWED_EXT = new Set(["mp4", "mov", "webm", "mkv", "avi"]);

export async function uploadVideo(req, res, next) {
  const filename = req.headers.filename;

  // @CUSTOM_ERROR
  if (!filename) throw new Error("No file provided.");

  const parsedFile = path.parse(filename);
  const name = parsedFile.name;
  const ext = parsedFile.ext.slice(1).toLowerCase();

  // @CUSTOM_ERROR
  if (!ALLOWED_EXT.has(ext))
    throw new Error(`Error: extension: ${ext || "none"} is not allowed.`);

  const videoId = crypto.randomBytes(4).toString("hex");
  const parentPath = `./storage/${videoId}`;
  const vidPath = path.join(parentPath, `original.${ext}`);
  const thumbnailPath = path.join(parentPath, `thumbnail.jpg`);

  try {
    await promiseFs.mkdir(parentPath, { recursive: true });

    const fileStream = fs.createWriteStream(vidPath);
    const validator = new VideoValidator();

    await pipeline(req, validator, fileStream);

    // creating video thumbnail
    await FF.makeThumbnails(vidPath, thumbnailPath);

    // store to db;
    db.update();
    db.videos.unshift({
      id: db.videos.length,
      videoId,
      name,
      ext,
      userId: req.user.id,
      extractedAudio: false,
      resizes: {},
    });

    db.save();

    return res.status(200).json({
      status: "success",
      message: "Uploaded successfully.",
    });
  } catch (e) {
    // @CUSTOM_ERROR
    if (e.code !== "ECONNRESET") throw e;
    // delete folder && don't throw error if file not exist
    await promiseFs.rm(parentPath, { recursive: true, force: true });
  }
}

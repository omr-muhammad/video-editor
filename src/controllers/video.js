import crypto from "node:crypto";
import path from "node:path";
import promiseFs from "node:fs/promises";
import fs, { read, stat } from "node:fs";
import { pipeline } from "node:stream/promises";
import { VideoValidator } from "../streams/videoValidator.js";
import * as FF from "../lib/ff.js";
import { db } from "../DB.js";
import util from "node:util";

const ALLOWED_EXT = new Set(["mp4", "mov", "webm", "mkv", "avi"]);

const videoMimeTypes = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  ts: "video/mp2t",
  mts: "video/mp2t",
  ogv: "video/ogg",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
};

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

    // get video dimensions
    const dimensions = await FF.getDimensions(vidPath);

    // store to db;
    db.update();
    db.videos.unshift({
      id: db.videos.length,
      videoId,
      name,
      extension: ext,
      dimensions,
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

export async function getVideos(req, res, next) {
  db.update();
  const userVideos = db.videos.filter((v) => v.userId === req.user.id);

  res.status(200).json(userVideos || []);
}

export async function getVideoAsset(req, res, next) {
  const { videoId, type } = req.query;

  // @CUSTOM_ERROR
  if (!videoId || !type) throw new Error(`Video id and type are missing.`);

  if (type === "thumbnail") return sendVideoThumbnail(res, videoId);
  else if (type === "original") return sendOriginal(res, videoId);
}

// helpers
async function sendVideoThumbnail(res, videoId) {
  try {
    const thumbnailPath = `./storage/${videoId}/thumbnail.jpg`;
    const readStream = fs.createReadStream(thumbnailPath);
    const stats = await util.promisify(fs.stat)(thumbnailPath);

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", stats.size);
    res.status(200);

    await pipeline(readStream, res);
  } catch (e) {
    //@CUSTOM_ERROR
    throw e;
  }
}

async function sendOriginal(res, videoId) {
  db.update();
  const { name, extension } = db.videos.find((v) => v.videoId === videoId);

  const videoPath = `./storage/${videoId}/original.${extension}`;
  const videoStream = fs.createReadStream(videoPath);
  const stats = await util.promisify(fs.stat)(videoPath);
  const filename = `${name}.${extension}`;

  res.setHeader("Content-Type", videoMimeTypes[extension]);
  res.setHeader("Content-Length", stats.size);
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  res.status(200);

  await pipeline(videoStream, res);
}

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
  // if type === resize dimension is required
  const { videoId, type, dimensions } = req.query;

  // @CUSTOM_ERROR
  if (!videoId || !type) throw new Error(`Video id and type are missing.`);

  // @CUSTOM_ERROR
  if (type === "resize" && !dimensions)
    throw new Error(`Dimensions is required when type resize.`);

  db.update();
  const video = db.videos.find((v) => v.videoId === videoId);

  const metadata = getMetadata(type, video, dimensions);

  await sendAsset(metadata, res);
}

// helpers
function getMetadata(type, vRecord, dimensions) {
  const { videoId, name, extension } = vRecord;

  let filePath = "";
  let filename = "";
  let mimeType = "";

  switch (type) {
    case "thumbnail":
      filePath = `./storage/${videoId}/thumbnail.jpg`;
      filename = "thumbnail.jpg";
      mimeType = "image/jpeg";
      break;

    case "original":
      filePath = `./storage/${videoId}/original.${extension}`;
      filename = `${name}.${extension}`;
      mimeType = videoMimeTypes[extension];
      break;

    case "audio":
      filePath = `./storage/${videoId}/audio.acc`;
      filename = `${name}-audio.acc`;
      mimeType = "audio/acc";
      break;

    case "resize":
      filePath = `./storage/${videoId}/${dimensions}.${extension}`;
      filename = `${name}-${dimensions}.${extension}`;
      mimeType = videoMimeTypes[extension];
      break;

    default:
      // @CUSTOM_ERROR
      throw new Error(`Not supported query fields.`);
  }

  return { filePath, filename, mimeType };
}

async function sendAsset(metadata, res) {
  const { filename, filePath, mimeType } = metadata;

  try {
    const readStream = fs.createReadStream(filePath);
    const stats = await util.promisify(fs.stat)(filePath);

    if (mimeType !== "image/jpeg") {
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", stats.size);
    res.status(200);

    await pipeline(readStream, res);
  } catch (e) {
    // @CUSTOM_ERROR
    throw e;
  }
}

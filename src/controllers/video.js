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
const isCluster = process.env.cluster_mode === "on";

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

const codecToExtension = {
  aac: "m4a",
  mp3: "mp3",
  opus: "opus",
  vorbis: "ogg",
  flac: "flac",
  alac: "m4a",
  pcm_s16le: "wav",
  pcm_s24le: "wav",
  pcm_s32le: "wav",
  pcm_f32le: "wav",
  ac3: "ac3",
  eac3: "eac3",
  dts: "dts",
  wmav2: "wma",
  wmapro: "wma",
  amr_nb: "amr",
  amr_wb: "amr",
  mp2: "mp2",
  truehd: "thd",
};

const codecToMimeType = {
  aac: "audio/aac",
  mp3: "audio/mpeg",
  opus: "audio/opus",
  vorbis: "audio/ogg",
  flac: "audio/flac",
  alac: "audio/mp4",
  pcm_s16le: "audio/wav",
  pcm_s24le: "audio/wav",
  pcm_s32le: "audio/wav",
  pcm_f32le: "audio/wav",
  ac3: "audio/ac3",
  eac3: "audio/eac3",
  dts: "audio/vnd.dts",
  wmav2: "audio/x-ms-wma",
  wmapro: "audio/x-ms-wma",
  amr_nb: "audio/amr",
  amr_wb: "audio/amr-wb",
  mp2: "audio/mpeg",
  truehd: "audio/x-truehd",
};

export async function uploadVideo(req, res, next) {
  const filename = req.headers.filename;

  // @CUSTOM_ERROR
  if (!filename) next({ status: 422, message: "No file provided." })

  const parsedFile = path.parse(filename);
  const name = parsedFile.name;
  const ext = parsedFile.ext.slice(1).toLowerCase();

  // @CUSTOM_ERROR
  if (!ALLOWED_EXT.has(ext))
    next({ status: 422, message: `Error: extension: ${ext || "none"} is not allowed.`})

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
    if (e.code !== "ECONNRESET") {
      console.error(e);
      if (e instanceof Error)
        next({ status: 422, messag: e.message })

      else next({ status: 500, message: e.message || "UNKNOWN ERR" })
    };
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
  if (!videoId || !type) next({ status: 400, message: `Missing required data (video id, type).` });

  // @CUSTOM_ERROR
  if (type === "resize" && !dimensions)
    next({ status: 400, message: `Dimensions is required when type resize.`})

  db.update();
  const video = db.videos.find((v) => v.videoId === videoId);

  try {
    const metadata = getMetadata(type, video, dimensions);

    await sendAsset(metadata, res);
  } catch (e) {
    console.error("GETTING VIDEO ASSET ERR: ", e);

    if (e instanceof Error) next({ status: 400, message: e.message });
    else next({ status: 500, message: "Something went wrong while getting video asset."})
  }

}

export async function extractAudio(req, res, next) {
  const { videoId } = req.query;

  // @CUSTOM_ERROR
  if (!videoId) next({ status: 400, message: `Video id is required.` });

  db.update();
  const video = db.videos.find((v) => v.videoId === videoId);

  // @CUSTOM_ERROR
  if (!video) next({ status: 404, message: `Video with id: ${videoId} not found` });

  // @CUSTOM_ERROR
  if (video.extractedAudio)
    next({ status: 400, message: `Audio already extracted for ${video.name} video.` });

  video.extractedAudio = true;
  db.save();

  let audioPath = "";
  try {
    const originalVideoPath = `./storage/${videoId}/original.${video.extension}`;
    const codec = await FF.getAudioCodec(originalVideoPath);
    const audioExtension = codecToExtension[codec];
    audioPath = `./storage/${videoId}/audio.${audioExtension}`;

    await FF.extractAudio(originalVideoPath, audioPath);

    video.audioCodec = codec;
    db.save();

    res.status(200).json({
      status: "success",
      message: "Audio extracted successfully.",
    });
  } catch (e) {
    // no Error if file not exist
    await promiseFs.rm(audioPath, { recursive: true, force: true });
    // @CUSTOM_ERROR
    console.error("EXTRACTING AUDIO ERR: ", e);

    if (e instanceof Error) next({ status: 400, message: e.message });
    else next({ status: 500, message: `Something went wrong while extracting audio`})
  }
}

export async function resize(req, res, next) {
  let { videoId, width, height } = req.body;

  // @CUSTOM_ERROR
  if (!videoId || !Number(width) || !Number(height))
    next({ status: 400, message: `Missing required data.` });

  db.update();
  const video = db.videos.find((v) => v.videoId === videoId);

  // @CUSTOM_ERROR
  if (!video) next({ status: 404, message: `Video with id: ${videoId} not found.` });

  const resizeObj = {
    type: "resize",
    videoId,
    width,
    height,
  };

  if (isCluster) process.send({ type: "newResize", data: resizeObj });
  else {
    const jobsQ = await import("../lib/queue.js");
    try {
    jobsQ.enqueue(resizeObj);
    } catch (e) {
      if (e.message) return next({ status: 400, message: e.message });
      else return next({ status: 500, message: `Something went wrong while resizing.`})
    }
  }

  return res.status(200).json({
    status: "success",
    message: `Generating ${width}x${height} for ${video.name} video.`,
  });
}

// helpers
function getMetadata(type, vRecord, dimensions) {
  const { videoId, name, extension, audioCodec } = vRecord;

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
      filePath = `./storage/${videoId}/audio.${codecToExtension[audioCodec]}`;
      filename = `${name}-audio.${codecToExtension[audioCodec]}`;
      mimeType = codecToMimeType[audioCodec];
      break;

    case "resize":
      filePath = `./storage/${videoId}/resizes/${dimensions}.${extension}`;
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

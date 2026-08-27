import crypto from "node:crypto";
import path from "node:path";
import promiseFs from "node:fs/promises";
import fs, { read, stat } from "node:fs";
import { pipeline } from "node:stream/promises";
import { VideoValidator } from "../streams/videoValidator.js";
import * as FF from "../lib/ff.js";
import { db } from "../DB.js";
import util from "node:util";
import { codecToExtension, codecToMimeType, videoMimeTypes, allowedVideoExt } from "../utils/constants.js"
import { Video } from "../db/models/video.js";
import mongoose from "mongoose";

const isCluster = process.env.cluster_mode === "on";

export async function uploadVideo(req, res, next) {
  const filename = req.headers.filename;

  // @CUSTOM_ERROR
  if (!filename) next({ status: 422, message: "No file provided." })

  const parsedFile = path.parse(filename);
  const name = parsedFile.name;
  const ext = parsedFile.ext.slice(1).toLowerCase();

  // @CUSTOM_ERROR
  if (!allowedVideoExt.has(ext))
    next({ status: 422, message: `Error: extension: ${ext || "none"} is not allowed.`})

  const videoId = new mongoose.Types.ObjectId();
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

    const newVideo = await Video.create({
      _id: videoId,
      name,
      extension: ext,
      dimensions,
      user: req.user.id,
    });

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
  const userVideos = await Video.find({ user: req.user._id });

  res.status(200).json(userVideos);
}

export async function getVideoAsset(req, res, next) {
  // if type === resize dimension is required
  const { type, dimensions } = req.query;
  const { videoId } = req.params;

  // @CUSTOM_ERROR
  if (!videoId || !type) next({ status: 400, message: `Missing required data (video id, type).` });

  // @CUSTOM_ERROR
  if (type === "resize" && !dimensions)
    next({ status: 400, message: `Dimensions is required when type resize.`})

  const video = await Video.findById(videoId);

  if (!video) next({ status: 404, message: `Video with id: ${videoId} not found.`})

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
  const { videoId } = req.params;

  // @CUSTOM_ERROR
  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId))
    next({ status: 400, message: `Video id is required.` });

  const video = await Video.findById(videoId);

  // @CUSTOM_ERROR
  if (!video) next({ status: 404, message: `Video with id: ${videoId} not found` });

  // @CUSTOM_ERROR
  if (video.audio.status !== "extracted")
    next({ status: 400, message: `Audio already extracted for ${video.name} video.` });

  let audioPath = "";
  try {
    const originalVideoPath = `./storage/${videoId}/original.${video.extension}`;
    const codec = await FF.getAudioCodec(originalVideoPath);
    const audioExtension = codecToExtension[codec];
    audioPath = `./storage/${videoId}/audio.${audioExtension}`;

    video.audio = { status: "processing", codec };
    await video.save()

    await FF.extractAudio(originalVideoPath, audioPath);

    video.audio.status = "extracted";
    await video.save()

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
  const { width, height } = req.body;
  const { videoId } = req.params;

  // @CUSTOM_ERROR
  if (!videoId || mongoose.Types.ObjectId.isValid(videoId))
    next({ status: 422, message: `Invalid video id.`})

  if (!Number(width) || !Number(height))
    next({ status: 422, message: `Missing required data (width and heigth).` });

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
    message: `Resizing is taking action.`,
  });
}

// helpers
function getMetadata(type, vRecord, dimensions) {
  const { id: videoId, name, extension, audioCodec } = vRecord;

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

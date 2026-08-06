import { db } from "../DB.js";
import promiseFs from "node:fs/promises";
import * as FF from "./ff.js";

const jobs = [];
let currentJob = null;

export function enqueue(newJob) {
  jobs.push(newJob);
  executeNext();
}

function dequeue() {
  return jobs.shift();
}

async function execute() {
  const { videoId, width, height } = currentJob;

  db.update();
  const video = db.videos.find((v) => v.videoId === videoId);

  // @CUSTOM_ERROR
  if (!video) throw new Error(`Video with id: ${videoId} not found.`);

  video.resizes[width + "x" + height] = { processing: true };
  db.save();

  const orignalPath = `./storage/${videoId}/original.${video.extension}`;
  const targetPath = `./storage/${videoId}/resizes/${width}x${height}.${video.extension}`;

  try {
    await promiseFs.mkdir(`./storage/${videoId}/resizes`, { recursive: true });
    await FF.resize(orignalPath, targetPath, Number(width), Number(height));

    video.resizes[width + "x" + height] = { processing: false };
    db.save();
  } catch (e) {
    await promiseFs.rm(targetPath, { recursive: true, force: true });

    // @CUSTOM_ERROR
    throw e;
  } finally {
    currentJob = null;
    return executeNext();
  }
}

function executeNext() {
  if (currentJob) return;

  currentJob = dequeue();

  // check if queue was empty
  if (!currentJob) return;

  execute(); // no need to await since it won't executeNext until finishing currentJob
}

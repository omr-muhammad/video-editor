import { db } from "../DB.js";
import promiseFs from "node:fs/promises";
import * as FF from "./ff.js";
import { Video } from "../db/models/video.js";

const jobs = [];
let currentJob = null;

restartUnprocessedResizes();

export function enqueue(newJob) {
  jobs.push(newJob);
  executeNext();
}

function dequeue() {
  return jobs.shift();
}

async function execute() {
  const { videoId, width, height } = currentJob;

  const video = await Video.findById(videoId);

  // @CUSTOM_ERROR
  if (!video) throw new Error(`Video with id: ${videoId} not found.`);

  video.resizes = [
    { dimensions: `${width}x${height}`, status: "processing" },
    ...video.resizes,
  ];
  await video.save();

  const orignalPath = `./storage/${videoId}/original.${video.extension}`;
  const targetPath = `./storage/${videoId}/resizes/${width}x${height}.${video.extension}`;

  try {
    await promiseFs.mkdir(`./storage/${videoId}/resizes`, { recursive: true });
    await FF.resize(orignalPath, targetPath, Number(width), Number(height));

    video.resizes[0].status = "finished";
    await video.save();
  } catch (e) {
    await promiseFs.rm(targetPath, { recursive: true, force: true });

    // @CUSTOM_ERROR
    console.error("EXECUTE FN ERR: ", e);

    if (e instanceof Error) throw e;
    else throw new Error(`Something went wrong while resizing.`);
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

async function restartUnprocessedResizes() {
  const videos = await Video.find({ "resizes.status": "processing" }).select(
    "_id resizes",
  );

  if (videos.length <= 0) return;

  videos.forEach((v) => {
    for (const { dimensions } of v.resizes) {
      const [width, height] = dimensions.split("x");
      enqueue({ type: "resize", videoId: v._id, width, height });
    }
  });
}

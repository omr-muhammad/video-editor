import { spawn } from "node:child_process";

export function makeThumbnails(videoPath, outputPath) {
  return new Promise((res, rej) => {
    const child = spawn("ffmpeg", [
      "-i",
      videoPath,
      "-ss",
      "5",
      "-vframes",
      "1",
      "-y",
      outputPath,
    ]);

    let stderr = "";
    child.stderr.on("data", (c) => (stderr += c.toString()));

    child.on("close", (code) => {
      if (code === 0) res();
      else rej(new Error(`ffmpeg exit with code ${code}: ${stderr}`));
    });
  });
}

export function getDimensions(videoPath) {
  return new Promise((res, rej) => {
    const child = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=s=x:p=0",
      videoPath,
    ]);

    let dimensions = "";
    child.stdout.on("data", (chunk) => (dimensions += chunk.toString()));

    let stderr = "";
    child.stderr.on("data", (c) => (stderr += c.toString()));

    child.on("close", (code) => {
      if (code !== 0)
        return rej(new Error(`ffprobe exit with code ${code}: ${stderr}`));

      const [width, height] = dimensions.split("x").map((val) => val?.trim());
      res({ width, height });
    });
  });
}

export function getAudioCodec(videoPath) {
  return new Promise((res, rej) => {
    const child = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_name",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]);

    let ext = "";
    child.stdout.on("data", (chunk) => (ext += chunk.toString()));

    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    child.on("close", (code) => {
      console.log(ext.trim());
      if (code === 0) res(ext.trim());
      else rej(new Error(`ffprobe exit with code ${code}: ${stderr}`));
    });
  });
}

export function extractAudio(videoPath, targetAudioPath) {
  return new Promise((res, rej) => {
    const child = spawn("ffmpeg", [
      "-i",
      videoPath,
      "-vn",
      "-c:a",
      "copy",
      targetAudioPath,
    ]);

    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    child.on("close", (code) => {
      if (code === 0) res();
      else rej(new Error(`ffmpeg exit with code ${code}: ${stderr}`));
    });
  });
}

export function resize(originalPath, targetPath, width, height) {
  return new Promise((res, rej) => {
    const child = spawn("ffmpeg", [
      "-i",
      originalPath,
      "-vf",
      `scale=${width}:${height}`,
      "-c:a",
      "copy",
      targetPath,
    ]);

    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    child.on("close", (code) => {
      if (code === 0) res();
      else rej(`ffmpeg exist with code ${code}: ${stderr}`);
    });
  });
}

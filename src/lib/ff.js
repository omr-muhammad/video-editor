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

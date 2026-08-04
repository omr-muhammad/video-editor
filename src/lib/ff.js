import { spawn } from "node:child_process";

export async function makeThumbnails(videoPath, outputPath) {
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
    child.stderr.on("data", (c) => (stderr += c));

    child.on("close", (code) => {
      if (code === 0) res();
      else rej(new Error(`ffmpeg exit with code ${code}: ${stderr}`));
    });
  });
}

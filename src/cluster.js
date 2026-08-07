import cluster from "node:cluster";
import os from "node:os";

if (cluster.isPrimary) {
  const maxCores = os.cpus().length;
  const jobQ = await import("./lib/queue.js");

  for (let i = 0; i < maxCores; ++i) {
    cluster.fork();
  }

  cluster.on("message", (worker, msg) => {
    if (msg.type === "newResize") {
      // msg.data => type, videoId, width, height
      jobQ.enqueue(msg.data);
    }
  });

  cluster.on("exit", (worker, code, signal) => {
    console.log(
      `${signal} Error: Process with id: ${worker.process.pid} exit with code: ${code}`,
    );
    console.log("Restarting...");
    cluster.fork();
  });
} else await import("./index.js");

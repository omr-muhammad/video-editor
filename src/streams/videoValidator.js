import { Transform } from "node:stream";
import { Buffer } from "node:buffer";
import { detectVideoType } from "../lib/utils.js";

export class VideoValidator extends Transform {
  #MAX_SIZE = 50 * 1024 * 1024; // 50MB
  #SIGNATURE_CHECK_BYTES = 16;

  constructor(options) {
    super(options);

    this.size = 0;
    this.sigChecked = false;
    this.headerBuf = Buffer.alloc(0);
  }

  _transform(chunk, encoding, cb) {
    this.size += chunk.byteLength;

    if (this.size > this.#MAX_SIZE) return cb(new Error("FILE_TOO_LARGE"));

    if (!this.sigChecked) {
      this.headerBuf = Buffer.concat([this.headerBuf, chunk]);

      if (this.headerBuf < this.#SIGNATURE_CHECK_BYTES) return cb();

      this.sigChecked = true;
      const type = detectVideoType(this.headerBuf);

      if (!type) return cb(new Error("INVALID_VIDEO_TYPE"));

      this.push(this.headerBuf);
      this.headerBuf = null;
      cb();

      return;
    }

    this.push(chunk);
    cb();
  }

  // Handle if streamed file size is less than 16 bytes
  _flush(cb) {
    if (!this.sigChecked && this.headerBuf && this.headerBuf.length > 0) {
      const type = detectVideoType(this.headerBuf);

      if (!type) return cb(new Error("INVALID_VIDEO_TYPE"));

      this.push(this.headerBuf);
    }

    cb();
  }
}

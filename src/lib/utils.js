export function detectVideoType(buf) {
  if (buf.length >= 8 && buf.slice(4, 8).toString("ascii") === "ftyp") {
    return "mp4/mov"; // covers mp4, mov, m4v, 3gp
  }
  if (
    buf.length >= 4 &&
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  ) {
    return "webm/mkv"; // both use the EBML/Matroska header
  }
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "AVI "
  ) {
    return "avi";
  }
  return null;
}

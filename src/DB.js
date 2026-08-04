import fs from "node:fs";

const usersPath = "./data/users.json";
const videosPath = "./data/videos.json";

class DB {
  constructor() {
    this.users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    this.videos = JSON.parse(fs.readFileSync(videosPath, "utf8"));
  }

  update() {
    this.users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    this.videos = JSON.parse(fs.readFileSync(videosPath, "utf8"));
  }

  save() {
    fs.writeFileSync(usersPath, JSON.stringify(db.users));
    fs.writeFileSync(videosPath, JSON.stringify(db.videos));
  }
}

export const db = new DB();

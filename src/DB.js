import fs from "node:fs";

const usersPath = "./data/users";

class DB {
  constructor() {
    this.users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
  }

  update() {
    this.users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
  }

  save() {
    fs.writeFileSync(usersPath, JSON.stringify(db.users));
  }
}

export const db = new DB();

import { db } from "../DB.js";

export function serverIndex(req, res, next) {
  const routes = ["/", "/login", "/profile"];

  if (routes.indexOf(req.url) !== -1 && req.method === "GET") {
    return res.status(200).sendFile("./public/index.html", "text/html");
  } else {
    next();
  }
}

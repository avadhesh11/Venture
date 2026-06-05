import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongo from "./src/db/mongo.js";
import http from "http";
import { Server as IOServer } from "socket.io";
import setupSocket from "./src/sockets/index.js";

import notifications from "./src/routes/notification.js";
import home from "./src/routes/home.js";
import auth from "./src/routes/auth.js";
import club from "./src/routes/clubs.js";
import event from "./src/routes/event.js";
import teams from "./src/routes/team.js";
import schedule from "./src/routes/schedule.js";
import extra from "./src/routes/extra.js";
import match from "./src/routes/match.js";
dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5005;

/* ================= CORS ================= */
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.includes("192.168.") ||
        origin.includes("venture-flax.vercel.app")
      ) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

/* ================= DB ================= */
mongo();

/* ================= HTTP + SOCKET ================= */
const httpServer = http.createServer(app);

const io = new IOServer(httpServer, {
  cors: {
    origin: [/localhost/, /127\.0\.0\.1/, /192\.168\./, "https://venture-flax.vercel.app"],
    credentials: true,
  },
});

console.log("⚙️ Socket.IO initialized");

/* ================= 🔥 CRITICAL MIDDLEWARE ================= */
/* MUST BE BEFORE ROUTES */
app.locals.io = io;

app.use((req, res, next) => {
  if (!req.app.locals.io) {
    console.warn("[IO MIDDLEWARE] io NOT FOUND");
  } else {
    console.log("[IO MIDDLEWARE] io attached to request");
  }
  req.io = req.app.locals.io;
  next();
});

/* ================= ROUTES ================= */
app.use("/extra", extra);
app.use("/auth", auth);
app.use("/clubs", club);
app.use("/events", event);
app.use("/teams", teams);
app.use("/schedule", schedule);
app.use("/notifications", notifications);
app.use("/match",match);
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

/* ================= SOCKET HANDLERS ================= */
setupSocket(io);

/* ================= SERVER START ================= */
// httpServer.listen(PORT, "0.0.0.0", () => {
//   console.log("🚀 Server running on:", PORT);
// });

app.listen(PORT,()=>{
  console.log("🚀 Server running on:", PORT);
})

import "dotenv/config";
import cors from "cors";
import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { MongoClient } from "mongodb";
import { getAuth } from "../client/lib/auth.js";

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "restaurant";

const app = express();
let db = null;

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

function requireSession(req, res, next) {
  getAuth()
    .then((auth) =>
      auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    )
    .then((session) => {
      if (!session?.user) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
      req.session = session;
      req.user = session.user;
      next();
    })
    .catch(() => {
      res.status(401).json({ ok: false, error: "Unauthorized" });
    });
}

function requireStaffOrAdmin(req, res, next) {
  const role = req.user?.role;
  if (role !== "staff" && role !== "admin") {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
}

function registerRoutes() {
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, data: { mongo: db ? "connected" : "disconnected" } });
  });

  app.get("/api/me", async (req, res) => {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    res.json({
      ok: true,
      data: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role || "customer",
      },
    });
  });

  app.post("/api/session/check", requireSession, (req, res) => {
    res.json({
      ok: true,
      data: {
        id: req.user.id,
        role: req.user.role || "customer",
      },
    });
  });

  app.get(
    "/api/dashboard/ping",
    requireSession,
    requireStaffOrAdmin,
    (_req, res) => {
      res.json({ ok: true, data: { message: "staff access ok" } });
    }
  );
}

async function start() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    await db.command({ ping: 1 });
    console.log(`MongoDB connected (${DB_NAME})`);
  } catch (err) {
    console.warn("MongoDB not connected:", err.message);
  }

  app.use(express.json());
  registerRoutes();

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

start();

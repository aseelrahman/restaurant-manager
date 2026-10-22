import "dotenv/config";
import cors from "cors";
import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { MongoClient, ObjectId } from "mongodb";
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

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
}

const TABLE_STATUSES = ["available", "occupied", "reserved"];

function mapTable(doc) {
  return {
    id: doc._id.toString(),
    number: doc.number,
    seats: doc.seats,
    status: doc.status,
  };
}

function isDuplicateKeyError(err) {
  return err?.code === 11000;
}

const MENU_CATEGORIES = ["starters", "mains", "drinks", "desserts"];

function mapMenuItem(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description || "",
    price: doc.price,
    category: doc.category,
    available: doc.available,
    imageUrl: doc.imageUrl || null,
  };
}

function buildMenuFields(body, { partial = false } = {}) {
  const fields = {};
  const has = (key) =>
    partial ? Object.prototype.hasOwnProperty.call(body, key) : true;

  if (has("name")) {
    const name = String(body?.name ?? "").trim();
    if (!name) return { error: "Name is required" };
    fields.name = name;
  } else if (!partial) {
    return { error: "Name is required" };
  }

  if (has("description")) {
    fields.description = String(body?.description ?? "").trim();
  } else if (!partial) {
    fields.description = "";
  }

  if (has("price")) {
    const price = Number(body?.price);
    if (!Number.isInteger(price) || price < 0) {
      return { error: "Price must be whole cents ≥ 0" };
    }
    fields.price = price;
  } else if (!partial) {
    return { error: "Price is required" };
  }

  if (has("category")) {
    const category = String(body?.category ?? "").trim();
    if (!MENU_CATEGORIES.includes(category)) {
      return {
        error: `Category must be one of: ${MENU_CATEGORIES.join(", ")}`,
      };
    }
    fields.category = category;
  } else if (!partial) {
    return { error: "Category is required" };
  }

  if (has("available")) {
    fields.available = Boolean(body.available);
  } else if (!partial) {
    fields.available = true;
  }

  if (has("imageUrl")) {
    const imageUrl = String(body?.imageUrl ?? "").trim();
    fields.imageUrl = imageUrl || null;
  }

  return { fields };
}

const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "seated",
  "cancelled",
  "no_show",
];

function userIdFromSession(user) {
  const id = user?.id;
  if (!id) return null;
  if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
    return new ObjectId(id);
  }
  return id;
}

function mapReservation(doc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId ? doc.userId.toString() : null,
    guestName: doc.guestName,
    guestPhone: doc.guestPhone || null,
    partySize: doc.partySize,
    datetime:
      doc.datetime instanceof Date
        ? doc.datetime.toISOString()
        : doc.datetime,
    tableId: doc.tableId ? doc.tableId.toString() : null,
    status: doc.status,
    notes: doc.notes || null,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : doc.createdAt || null,
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : doc.updatedAt || null,
  };
}

function parseReservationDatetime(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
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

  // --- MENU ---
  app.get("/api/menu", async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    let filter = { available: true };
    try {
      const auth = await getAuth();
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (session?.user?.role === "admin") {
        filter = {};
      }
    } catch {
      /* public menu only */
    }
    try {
      const docs = await db
        .collection("menuItems")
        .find(filter)
        .sort({ category: 1, name: 1 })
        .toArray();
      res.json({ ok: true, data: docs.map(mapMenuItem) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to load menu" });
    }
  });

  app.post("/api/menu", requireSession, requireAdmin, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    const built = buildMenuFields(req.body);
    if (built.error) {
      return res.status(400).json({ ok: false, error: built.error });
    }
    const now = new Date();
    const doc = { ...built.fields, createdAt: now, updatedAt: now };
    try {
      const result = await db.collection("menuItems").insertOne(doc);
      const inserted = await db
        .collection("menuItems")
        .findOne({ _id: result.insertedId });
      res.status(201).json({ ok: true, data: mapMenuItem(inserted) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to create menu item" });
    }
  });

  app.patch("/api/menu/:id", requireSession, requireAdmin, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    let id;
    try {
      id = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid menu item id" });
    }
    const built = buildMenuFields(req.body, { partial: true });
    if (built.error) {
      return res.status(400).json({ ok: false, error: built.error });
    }
    if (Object.keys(built.fields).length === 0) {
      return res.status(400).json({ ok: false, error: "No fields to update" });
    }
    built.fields.updatedAt = new Date();
    try {
      const result = await db
        .collection("menuItems")
        .findOneAndUpdate(
          { _id: id },
          { $set: built.fields },
          { returnDocument: "after" }
        );
      if (!result) {
        return res.status(404).json({ ok: false, error: "Menu item not found" });
      }
      res.json({ ok: true, data: mapMenuItem(result) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to update menu item" });
    }
  });

  app.delete(
    "/api/menu/:id",
    requireSession,
    requireAdmin,
    async (req, res) => {
      if (!db) {
        return res
          .status(503)
          .json({ ok: false, error: "Database unavailable" });
      }
      let id;
      try {
        id = new ObjectId(req.params.id);
      } catch {
        return res
          .status(400)
          .json({ ok: false, error: "Invalid menu item id" });
      }
      try {
        const result = await db.collection("menuItems").deleteOne({ _id: id });
        if (result.deletedCount === 0) {
          return res
            .status(404)
            .json({ ok: false, error: "Menu item not found" });
        }
        res.json({ ok: true, data: { id: req.params.id } });
      } catch {
        res
          .status(500)
          .json({ ok: false, error: "Failed to delete menu item" });
      }
    }
  );

  // --- TABLES ---
  app.get("/api/tables", requireSession, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    try {
      const role = req.user?.role || "customer";
      const filter =
        role === "staff" || role === "admin" ? {} : { status: "available" };
      const docs = await db
        .collection("tables")
        .find(filter)
        .sort({ number: 1 })
        .toArray();
      res.json({ ok: true, data: docs.map(mapTable) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to load tables" });
    }
  });

  app.post(
    "/api/tables",
    requireSession,
    requireAdmin,
    async (req, res) => {
      if (!db) {
        return res
          .status(503)
          .json({ ok: false, error: "Database unavailable" });
      }
      const number = Number(req.body?.number);
      const seats = Number(req.body?.seats);
      if (!Number.isInteger(number) || number < 1) {
        return res
          .status(400)
          .json({ ok: false, error: "Table number must be a positive integer" });
      }
      if (!Number.isInteger(seats) || seats < 1) {
        return res
          .status(400)
          .json({ ok: false, error: "Seats must be a positive integer" });
      }
      try {
        const result = await db.collection("tables").insertOne({
          number,
          seats,
          status: "available",
        });
        const doc = await db
          .collection("tables")
          .findOne({ _id: result.insertedId });
        res.status(201).json({ ok: true, data: mapTable(doc) });
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          return res
            .status(409)
            .json({ ok: false, error: "Table number already exists" });
        }
        res.status(500).json({ ok: false, error: "Failed to add table" });
      }
    }
  );

  app.patch(
    "/api/tables/:id",
    requireSession,
    requireStaffOrAdmin,
    async (req, res) => {
      if (!db) {
        return res
          .status(503)
          .json({ ok: false, error: "Database unavailable" });
      }
      let id;
      try {
        id = new ObjectId(req.params.id);
      } catch {
        return res.status(400).json({ ok: false, error: "Invalid table id" });
      }
      const status = String(req.body?.status || "").trim();
      if (!TABLE_STATUSES.includes(status)) {
        return res.status(400).json({
          ok: false,
          error: `Status must be one of: ${TABLE_STATUSES.join(", ")}`,
        });
      }
      try {
        const result = await db
          .collection("tables")
          .findOneAndUpdate(
            { _id: id },
            { $set: { status } },
            { returnDocument: "after" }
          );
        if (!result) {
          return res.status(404).json({ ok: false, error: "Table not found" });
        }
        res.json({ ok: true, data: mapTable(result) });
      } catch {
        res.status(500).json({ ok: false, error: "Failed to update table" });
      }
    }
  );

  // --- RESERVATIONS ---
  app.get("/api/reservations", requireSession, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    const role = req.user?.role || "customer";
    const filter =
      role === "staff" || role === "admin"
        ? {}
        : { userId: userIdFromSession(req.user) };
    try {
      const docs = await db
        .collection("reservations")
        .find(filter)
        .sort({ datetime: 1 })
        .toArray();
      res.json({ ok: true, data: docs.map(mapReservation) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to load reservations" });
    }
  });

  app.post("/api/reservations", requireSession, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    const guestName = String(req.body?.guestName || "").trim();
    const partySize = Number(req.body?.partySize);
    const datetime = parseReservationDatetime(req.body?.datetime);
    const guestPhone = String(req.body?.guestPhone || "").trim();
    const notes = String(req.body?.notes || "").trim();

    if (!guestName) {
      return res
        .status(400)
        .json({ ok: false, error: "Guest name is required" });
    }
    if (!Number.isInteger(partySize) || partySize < 1) {
      return res.status(400).json({
        ok: false,
        error: "Party size must be a positive integer",
      });
    }
    if (!datetime) {
      return res
        .status(400)
        .json({ ok: false, error: "Valid reservation date and time required" });
    }
    if (datetime.getTime() < Date.now()) {
      return res.status(400).json({
        ok: false,
        error: "Reservation must be in the future",
      });
    }

    const now = new Date();
    const doc = {
      userId: userIdFromSession(req.user),
      guestName,
      partySize,
      datetime,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    if (guestPhone) doc.guestPhone = guestPhone;
    if (notes) doc.notes = notes;

    try {
      const result = await db.collection("reservations").insertOne(doc);
      const inserted = await db
        .collection("reservations")
        .findOne({ _id: result.insertedId });
      res.status(201).json({ ok: true, data: mapReservation(inserted) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to create reservation" });
    }
  });

  app.patch("/api/reservations/:id", requireSession, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    let id;
    try {
      id = new ObjectId(req.params.id);
    } catch {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid reservation id" });
    }

    const role = req.user?.role || "customer";
    const nextStatus = String(req.body?.status || "").trim();

    if (role !== "staff" && role !== "admin") {
      if (nextStatus !== "cancelled") {
        return res.status(403).json({
          ok: false,
          error: "Only staff can update reservation status",
        });
      }

      try {
        const existing = await db
          .collection("reservations")
          .findOne({ _id: id, userId: userIdFromSession(req.user) });
        if (!existing) {
          return res
            .status(404)
            .json({ ok: false, error: "Reservation not found" });
        }
        if (
          existing.status !== "pending" &&
          existing.status !== "confirmed"
        ) {
          return res.status(400).json({
            ok: false,
            error: "Only pending or confirmed reservations can be cancelled",
          });
        }

        const result = await db.collection("reservations").findOneAndUpdate(
          { _id: id },
          { $set: { status: "cancelled", updatedAt: new Date() } },
          { returnDocument: "after" }
        );
        res.json({ ok: true, data: mapReservation(result) });
      } catch {
        res
          .status(500)
          .json({ ok: false, error: "Failed to cancel reservation" });
      }
      return;
    }

    if (!RESERVATION_STATUSES.includes(nextStatus)) {
      return res.status(400).json({
        ok: false,
        error: `Status must be one of: ${RESERVATION_STATUSES.join(", ")}`,
      });
    }
    res.status(501).json({
      ok: false,
      error: "Staff reservation actions are not implemented yet",
    });
  });
}

async function start() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    await db.command({ ping: 1 });
    await db
      .collection("tables")
      .createIndex({ number: 1 }, { unique: true });
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

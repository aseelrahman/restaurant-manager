import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { MongoClient, ObjectId } from "mongodb";
import { getAuth } from "../client/lib/auth.js";
import {
  constructStripeEvent,
  createBillCheckoutSession,
  isStripeConfigured,
} from "./stripe.js";

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__serverDir, ".env") });

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

const RESERVATION_OVERLAP_MS = 2 * 60 * 60 * 1000;

async function findReservationTableOverlap(dbHandle, tableId, datetime, excludeId) {
  const slot = datetime instanceof Date ? datetime : new Date(datetime);
  const from = new Date(slot.getTime() - RESERVATION_OVERLAP_MS);
  const to = new Date(slot.getTime() + RESERVATION_OVERLAP_MS);
  return dbHandle.collection("reservations").findOne({
    _id: { $ne: excludeId },
    tableId,
    status: { $in: ["confirmed", "seated"] },
    datetime: { $gte: from, $lte: to },
  });
}

async function releaseTableIfReservedFor(dbHandle, reservation) {
  if (!reservation?.tableId) return;
  const table = await dbHandle.collection("tables").findOne({
    _id: reservation.tableId,
  });
  if (table && (table.status === "reserved" || table.status === "occupied")) {
    const activeOnTable = await dbHandle.collection("reservations").findOne({
      tableId: reservation.tableId,
      status: { $in: ["confirmed", "seated"] },
      _id: { $ne: reservation._id },
    });
    if (!activeOnTable) {
      await dbHandle
        .collection("tables")
        .updateOne(
          { _id: reservation.tableId },
          { $set: { status: "available" } }
        );
    }
  }
}

function mapStaffUser(doc) {
  return {
    id: doc.id || doc._id?.toString(),
    name: doc.name,
    email: doc.email,
    role: doc.role || "customer",
  };
}

const TAX_RATE = Number(process.env.TAX_RATE) || 0.1;
const ORDER_STATUSES = [
  "awaiting_payment",
  "pending",
  "preparing",
  "ready",
  "served",
  "paid",
  "cancelled",
];
const ORDER_NEXT = {
  pending: "preparing",
  preparing: "ready",
  ready: "served",
};
const BILL_STATUSES = ["unpaid", "paid", "void"];
const MANUAL_PAY_METHODS = ["cash", "card"];

function mapOrder(doc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId ? doc.userId.toString() : null,
    tableId: doc.tableId ? doc.tableId.toString() : null,
    placedBy: doc.placedBy,
    items: doc.items,
    status: doc.status,
    subtotal: doc.subtotal,
    notes: doc.notes || null,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : doc.createdAt,
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : doc.updatedAt,
  };
}

function mapBill(doc) {
  return {
    id: doc._id.toString(),
    orderId: doc.orderId.toString(),
    userId: doc.userId ? doc.userId.toString() : null,
    tableId: doc.tableId ? doc.tableId.toString() : null,
    lines: doc.lines,
    subtotal: doc.subtotal,
    tax: doc.tax,
    total: doc.total,
    method: doc.method || null,
    status: doc.status,
    paymentProvider: doc.paymentProvider || null,
    stripeCheckoutSessionId: doc.stripeCheckoutSessionId || null,
    stripePaymentIntentId: doc.stripePaymentIntentId || null,
    paidAt:
      doc.paidAt instanceof Date ? doc.paidAt.toISOString() : doc.paidAt || null,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : doc.createdAt,
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : doc.updatedAt,
  };
}

function calcTax(subtotalCents) {
  return Math.round(subtotalCents * TAX_RATE);
}

async function markBillPaid(
  dbHandle,
  billId,
  payment,
  { orderStatus = "paid", tableStatus = "available" } = {}
) {
  const bill = await dbHandle.collection("bills").findOne({ _id: billId });
  if (!bill) return { error: "Bill not found", status: 404 };
  if (bill.status !== "unpaid") {
    return { error: "Bill is not unpaid", status: 400 };
  }

  const now = new Date();
  const billUpdate = {
    status: "paid",
    method: payment.method || "card",
    paymentProvider: payment.paymentProvider || "manual",
    paidAt: now,
    updatedAt: now,
  };
  if (payment.stripeCheckoutSessionId) {
    billUpdate.stripeCheckoutSessionId = payment.stripeCheckoutSessionId;
  }
  if (payment.stripePaymentIntentId) {
    billUpdate.stripePaymentIntentId = payment.stripePaymentIntentId;
  }

  await dbHandle.collection("bills").updateOne(
    { _id: billId },
    { $set: billUpdate }
  );

  const order = await dbHandle.collection("orders").findOne({
    _id: bill.orderId,
  });
  if (order) {
    await dbHandle.collection("orders").updateOne(
      { _id: bill.orderId },
      { $set: { status: orderStatus, updatedAt: now } }
    );
    if (order.tableId && tableStatus) {
      await dbHandle
        .collection("tables")
        .updateOne(
          { _id: order.tableId },
          { $set: { status: tableStatus } }
        );
    }
  }

  const updated = await dbHandle.collection("bills").findOne({ _id: billId });
  return { bill: mapBill(updated) };
}

async function handleStripeWebhook(req, res) {
  if (!db) {
    return res.status(503).send("Database unavailable");
  }
  const signature = req.headers["stripe-signature"];
  const { event, error } = constructStripeEvent(req.body, signature);
  if (error) {
    return res.status(400).send(error);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const billIdStr = session.metadata?.billId;
    if (!billIdStr) {
      return res.json({ received: true });
    }
    let billId;
    try {
      billId = new ObjectId(billIdStr);
    } catch {
      return res.status(400).send("Invalid bill id in metadata");
    }
    const payAtOrder = session.metadata?.flow === "order";
    const result = await markBillPaid(
      db,
      billId,
      {
        method: "card",
        paymentProvider: "stripe",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: session.payment_intent || null,
      },
      payAtOrder
        ? { orderStatus: "pending", tableStatus: "occupied" }
        : { orderStatus: "paid", tableStatus: "available" }
    );
    if (result.error) {
      console.warn("Stripe webhook mark paid:", result.error);
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    if (session.metadata?.flow === "order" && session.metadata.billId) {
      let billId;
      try {
        billId = new ObjectId(session.metadata.billId);
      } catch {
        return res.status(400).send("Invalid bill id in metadata");
      }
      const bill = await db.collection("bills").findOne({ _id: billId });
      if (bill?.status === "unpaid") {
        const now = new Date();
        await db.collection("bills").updateOne(
          { _id: billId },
          { $set: { status: "void", updatedAt: now } }
        );
        await db.collection("orders").updateOne(
          { _id: bill.orderId, status: "awaiting_payment" },
          { $set: { status: "cancelled", updatedAt: now } }
        );
      }
    }
  }

  res.json({ received: true });
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
    const role = req.user?.role || "customer";
    if (role !== "staff" && role !== "admin") {
      if (datetime.getTime() < Date.now()) {
        return res.status(400).json({
          ok: false,
          error: "Reservation must be in the future",
        });
      }
    } else if (datetime.getTime() < Date.now() - 60 * 60 * 1000) {
      return res.status(400).json({
        ok: false,
        error: "Walk-in time cannot be more than one hour in the past",
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
        await releaseTableIfReservedFor(db, existing);
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

    try {
      const existing = await db.collection("reservations").findOne({ _id: id });
      if (!existing) {
        return res
          .status(404)
          .json({ ok: false, error: "Reservation not found" });
      }

      const now = new Date();
      const update = { status: nextStatus, updatedAt: now };
      let tableId = existing.tableId;

      if (req.body?.tableId) {
        try {
          tableId = new ObjectId(req.body.tableId);
        } catch {
          return res
            .status(400)
            .json({ ok: false, error: "Invalid table id" });
        }
      }

      if (nextStatus === "confirmed") {
        if (tableId) {
          if (
            existing.tableId &&
            existing.tableId.toString() !== tableId.toString()
          ) {
            await releaseTableIfReservedFor(db, existing);
          }
          const table = await db.collection("tables").findOne({ _id: tableId });
          if (!table) {
            return res
              .status(400)
              .json({ ok: false, error: "Table not found" });
          }
          if (existing.partySize > table.seats) {
            return res.status(400).json({
              ok: false,
              error: "Party size exceeds table capacity",
            });
          }
          const overlap = await findReservationTableOverlap(
            db,
            tableId,
            existing.datetime,
            id
          );
          if (overlap) {
            return res.status(409).json({
              ok: false,
              error: "Table already booked for an overlapping time",
            });
          }
          update.tableId = tableId;
          await db
            .collection("tables")
            .updateOne({ _id: tableId }, { $set: { status: "reserved" } });
        }
      }

      if (nextStatus === "seated") {
        if (!tableId) {
          return res.status(400).json({
            ok: false,
            error: "Assign a table before seating",
          });
        }
        update.tableId = tableId;
        await db
          .collection("tables")
          .updateOne({ _id: tableId }, { $set: { status: "occupied" } });
      }

      if (
        nextStatus === "cancelled" ||
        nextStatus === "no_show"
      ) {
        await releaseTableIfReservedFor(db, existing);
      }

      const result = await db.collection("reservations").findOneAndUpdate(
        { _id: id },
        { $set: update },
        { returnDocument: "after" }
      );
      res.json({ ok: true, data: mapReservation(result) });
    } catch {
      res
        .status(500)
        .json({ ok: false, error: "Failed to update reservation" });
    }
  });

  // --- ORDERS ---
  app.get("/api/orders", requireSession, async (req, res) => {
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
        .collection("orders")
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      res.json({ ok: true, data: docs.map(mapOrder) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to load orders" });
    }
  });

  app.post("/api/orders", requireSession, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    const role = req.user?.role || "customer";
    const isStaff = role === "staff" || role === "admin";
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: "Order needs items" });
    }

    let tableId = null;
    if (req.body?.tableId) {
      try {
        tableId = new ObjectId(req.body.tableId);
      } catch {
        return res.status(400).json({ ok: false, error: "Invalid table id" });
      }
    }

    let placedBy = "customer";
    if (isStaff) {
      if (req.body?.walkIn === true) {
        placedBy = "staff";
      } else {
        return res.status(400).json({
          ok: false,
          error: "Staff orders must include walkIn: true",
        });
      }
    }

    const lines = [];
    let subtotal = 0;
    for (const line of items) {
      let menuItemId;
      try {
        menuItemId = new ObjectId(line.menuItemId);
      } catch {
        return res
          .status(400)
          .json({ ok: false, error: "Invalid menu item id in cart" });
      }
      const qty = Number(line.qty);
      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ ok: false, error: "Invalid quantity" });
      }
      const menuItem = await db.collection("menuItems").findOne({
        _id: menuItemId,
        available: true,
      });
      if (!menuItem) {
        return res
          .status(400)
          .json({ ok: false, error: "Menu item unavailable" });
      }
      const price = menuItem.price;
      subtotal += price * qty;
      lines.push({
        menuItemId,
        name: menuItem.name,
        price,
        qty,
        notes: String(line.notes || "").trim() || undefined,
      });
    }

    if (tableId) {
      const table = await db.collection("tables").findOne({ _id: tableId });
      if (!table) {
        return res.status(400).json({ ok: false, error: "Table not found" });
      }
      if (table.status !== "available" && table.status !== "reserved") {
        return res.status(400).json({
          ok: false,
          error: "Table is not available for dine-in",
        });
      }
    }

    const payNow = placedBy === "customer";
    if (payNow && !isStripeConfigured()) {
      return res.status(503).json({
        ok: false,
        error: "Card checkout is not configured",
      });
    }

    const now = new Date();
    const doc = {
      userId:
        placedBy === "customer" ? userIdFromSession(req.user) : null,
      tableId: tableId || undefined,
      placedBy,
      items: lines,
      status: payNow ? "awaiting_payment" : "pending",
      subtotal,
      notes: String(req.body?.notes || "").trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await db.collection("orders").insertOne(doc);
      if (tableId && !payNow) {
        await db
          .collection("tables")
          .updateOne({ _id: tableId }, { $set: { status: "occupied" } });
      }
      const inserted = await db
        .collection("orders")
        .findOne({ _id: result.insertedId });

      if (!payNow) {
        return res.status(201).json({ ok: true, data: mapOrder(inserted) });
      }

      const tax = calcTax(subtotal);
      const billResult = await db.collection("bills").insertOne({
        orderId: inserted._id,
        userId: inserted.userId || null,
        tableId: inserted.tableId || null,
        lines,
        subtotal,
        tax,
        total: subtotal + tax,
        status: "unpaid",
        createdAt: now,
        updatedAt: now,
      });
      const base = CLIENT_ORIGIN.replace(/\/$/, "");
      const { session, error } = await createBillCheckoutSession({
        billId: billResult.insertedId.toString(),
        orderId: inserted._id.toString(),
        lines,
        taxCents: tax,
        flow: "order",
        customerEmail: req.user?.email,
        successUrl: `${base}/account/orders?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}/cart?cancelled=1`,
      });
      if (error || !session?.url) {
        await db.collection("bills").deleteOne({ _id: billResult.insertedId });
        await db.collection("orders").deleteOne({ _id: inserted._id });
        return res.status(500).json({
          ok: false,
          error: error || "Could not start checkout",
        });
      }

      await db.collection("bills").updateOne(
        { _id: billResult.insertedId },
        { $set: { stripeCheckoutSessionId: session.id, updatedAt: new Date() } }
      );

      res.status(201).json({
        ok: true,
        data: {
          ...mapOrder(inserted),
          checkoutUrl: session.url,
          billId: billResult.insertedId.toString(),
        },
      });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to create order" });
    }
  });

  app.patch("/api/orders/:id/status", requireSession, requireStaffOrAdmin, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    let id;
    try {
      id = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid order id" });
    }
    const nextStatus = String(req.body?.status || "").trim();
    if (nextStatus === "paid") {
      return res.status(400).json({
        ok: false,
        error: "Mark order paid via billing, not kitchen board",
      });
    }

    try {
      const order = await db.collection("orders").findOne({ _id: id });
      if (!order) {
        return res.status(404).json({ ok: false, error: "Order not found" });
      }
      const current = order.status;
      if (nextStatus === "cancelled") {
        if (current !== "pending" && current !== "preparing") {
          return res.status(400).json({
            ok: false,
            error: "Can only cancel pending or preparing orders",
          });
        }
      } else if (ORDER_NEXT[current] !== nextStatus) {
        return res.status(400).json({
          ok: false,
          error: `Invalid transition from ${current} to ${nextStatus}`,
        });
      } else if (!ORDER_STATUSES.includes(nextStatus)) {
        return res.status(400).json({ ok: false, error: "Invalid status" });
      }

      const updated = await db.collection("orders").findOneAndUpdate(
        { _id: id },
        { $set: { status: nextStatus, updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      res.json({ ok: true, data: mapOrder(updated) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to update order" });
    }
  });

  // --- BILLS ---
  app.get("/api/bills", requireSession, async (req, res) => {
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
        .collection("bills")
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      res.json({ ok: true, data: docs.map(mapBill) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to load bills" });
    }
  });

  app.get("/api/payments/config", (_req, res) => {
    res.json({
      ok: true,
      data: {
        stripeEnabled: isStripeConfigured(),
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
      },
    });
  });

  app.post("/api/bills", requireSession, requireStaffOrAdmin, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    let orderId;
    try {
      orderId = new ObjectId(req.body?.orderId);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid order id" });
    }

    try {
      const existingBill = await db
        .collection("bills")
        .findOne({ orderId });
      if (existingBill) {
        return res.status(409).json({
          ok: false,
          error: "Bill already exists for this order",
        });
      }

      const order = await db.collection("orders").findOne({ _id: orderId });
      if (!order) {
        return res.status(404).json({ ok: false, error: "Order not found" });
      }
      if (order.status !== "served") {
        return res.status(400).json({
          ok: false,
          error: "Bill can only be created from a served order",
        });
      }

      const subtotal = order.subtotal;
      const tax = calcTax(subtotal);
      const total = subtotal + tax;
      const now = new Date();
      const doc = {
        orderId,
        userId: order.userId || null,
        tableId: order.tableId || null,
        lines: order.items,
        subtotal,
        tax,
        total,
        status: "unpaid",
        createdAt: now,
        updatedAt: now,
      };

      const result = await db.collection("bills").insertOne(doc);
      const inserted = await db
        .collection("bills")
        .findOne({ _id: result.insertedId });
      res.status(201).json({ ok: true, data: mapBill(inserted) });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        return res.status(409).json({
          ok: false,
          error: "Bill already exists for this order",
        });
      }
      res.status(500).json({ ok: false, error: "Failed to create bill" });
    }
  });

  app.patch("/api/bills/:id/pay", requireSession, requireStaffOrAdmin, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    let billId;
    try {
      billId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid bill id" });
    }
    const method = String(req.body?.method || "").trim();
    if (!MANUAL_PAY_METHODS.includes(method)) {
      return res.status(400).json({
        ok: false,
        error: "Method must be cash or card",
      });
    }

    const result = await markBillPaid(db, billId, {
      method,
      paymentProvider: "manual",
    });
    if (result.error) {
      return res
        .status(result.status || 400)
        .json({ ok: false, error: result.error });
    }
    res.json({ ok: true, data: result.bill });
  });

  app.patch("/api/bills/:id/void", requireSession, requireStaffOrAdmin, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    let billId;
    try {
      billId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid bill id" });
    }
    try {
      const bill = await db.collection("bills").findOne({ _id: billId });
      if (!bill) {
        return res.status(404).json({ ok: false, error: "Bill not found" });
      }
      if (bill.status !== "unpaid") {
        return res.status(400).json({
          ok: false,
          error: "Only unpaid bills can be voided",
        });
      }
      const updated = await db.collection("bills").findOneAndUpdate(
        { _id: billId },
        { $set: { status: "void", updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      res.json({ ok: true, data: mapBill(updated) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to void bill" });
    }
  });

  app.post("/api/bills/:id/stripe/checkout", requireSession, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    if (!isStripeConfigured()) {
      return res.status(503).json({
        ok: false,
        error: "Stripe is not configured on the server",
      });
    }

    let billId;
    try {
      billId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid bill id" });
    }

    const bill = await db.collection("bills").findOne({ _id: billId });
    if (!bill) {
      return res.status(404).json({ ok: false, error: "Bill not found" });
    }
    if (bill.status !== "unpaid") {
      return res.status(400).json({ ok: false, error: "Bill is not unpaid" });
    }

    const role = req.user?.role || "customer";
    const uid = userIdFromSession(req.user);
    if (role === "customer") {
      if (
        !bill.userId ||
        bill.userId.toString() !== (uid?.toString?.() || uid)
      ) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
    }

    const order = await db.collection("orders").findOne({ _id: bill.orderId });
    const flow = order?.status === "awaiting_payment" ? "order" : "bill";
    const base = CLIENT_ORIGIN.replace(/\/$/, "");
    const { session, error } = await createBillCheckoutSession({
      billId: billId.toString(),
      orderId: bill.orderId.toString(),
      lines: bill.lines,
      taxCents: bill.tax,
      totalCents: bill.total,
      flow,
      customerEmail: req.user?.email,
      successUrl:
        flow === "order"
          ? `${base}/account/orders?paid=1&session_id={CHECKOUT_SESSION_ID}`
          : `${base}/account/bills?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:
        flow === "order"
          ? `${base}/cart?cancelled=1`
          : `${base}/account/bills?cancelled=1`,
    });
    if (error || !session?.url) {
      return res.status(500).json({
        ok: false,
        error: error || "Could not start checkout",
      });
    }

    await db.collection("bills").updateOne(
      { _id: billId },
      {
        $set: {
          stripeCheckoutSessionId: session.id,
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      ok: true,
      data: { checkoutUrl: session.url, sessionId: session.id },
    });
  });

  // --- STAFF ---
  app.get("/api/staff", requireSession, requireAdmin, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    try {
      const docs = await db
        .collection("user")
        .find({ role: { $in: ["staff", "admin"] } })
        .sort({ email: 1 })
        .toArray();
      res.json({ ok: true, data: docs.map(mapStaffUser) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to load staff" });
    }
  });

  app.patch("/api/staff", requireSession, requireAdmin, async (req, res) => {
    if (!db) {
      return res
        .status(503)
        .json({ ok: false, error: "Database unavailable" });
    }
    const newRole = String(req.body?.role || "").trim();
    const STAFF_ROLES = ["customer", "staff", "admin"];
    if (!STAFF_ROLES.includes(newRole)) {
      return res.status(400).json({ ok: false, error: "Invalid role" });
    }

    const emailRaw = req.body?.email
      ? String(req.body.email).trim().toLowerCase()
      : "";
    const userId = req.body?.userId || req.body?.id;
    let filter;
    if (emailRaw) {
      filter = { email: emailRaw };
    } else if (userId) {
      filter = { id: String(userId) };
    } else {
      return res.status(400).json({
        ok: false,
        error: "email or userId is required",
      });
    }

    try {
      const result = await db.collection("user").findOneAndUpdate(
        filter,
        { $set: { role: newRole, updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      if (!result) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      res.json({ ok: true, data: mapStaffUser(result) });
    } catch {
      res.status(500).json({ ok: false, error: "Failed to update role" });
    }
  });

  // --- DASHBOARD ---
  app.get(
    "/api/dashboard/summary",
    requireSession,
    requireStaffOrAdmin,
    async (req, res) => {
      if (!db) {
        return res
          .status(503)
          .json({ ok: false, error: "Database unavailable" });
      }
      try {
        const openOrders = await db.collection("orders").countDocuments({
          status: { $nin: ["awaiting_payment", "served", "paid", "cancelled"] },
        });
        const occupiedTables = await db
          .collection("tables")
          .countDocuments({ status: "occupied" });

        const now = new Date();
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(endOfToday.getDate() + 1);

        const reservationsToday = await db
          .collection("reservations")
          .countDocuments({
            status: { $in: ["pending", "confirmed"] },
            datetime: { $gte: startOfToday, $lt: endOfToday },
          });

        const unpaidBills = await db
          .collection("bills")
          .countDocuments({ status: "unpaid" });

        res.json({
          ok: true,
          data: {
            openOrders,
            occupiedTables,
            reservationsToday,
            unpaidBills,
          },
        });
      } catch {
        res
          .status(500)
          .json({ ok: false, error: "Failed to load dashboard summary" });
      }
    }
  );
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
    await db
      .collection("bills")
      .createIndex({ orderId: 1 }, { unique: true });
    console.log(`MongoDB connected (${DB_NAME})`);
  } catch (err) {
    console.warn("MongoDB not connected:", err.message);
  }

  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
  );

  app.use(express.json());
  registerRoutes();

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    if (isStripeConfigured()) {
      console.log("Stripe: configured (checkout + webhooks ready)");
    } else {
      console.log("Stripe: not configured (manual billing only)");
    }
  });
}

start();

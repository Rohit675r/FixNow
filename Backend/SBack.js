// SBack.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { MongoClient, ObjectId } = require("mongodb");
const twilio = require("twilio");

// prefer global fetch (Node 18+) else fallback to node-fetch v2
const fetch = globalThis.fetch || (() => {
  try {
    // eslint-disable-next-line global-require
    return require("node-fetch");
  } catch (err) {
    console.error("node-fetch not available; please run Node >=18 or install node-fetch@2");
    throw err;
  }
})();

const app = express();
app.use(cors());
app.use(express.json());

// Config from env (with sane defaults)
const PORT = process.env.PORT || 5000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "mydb";
const DEFAULT_UPI_ID = process.env.DEFAULT_UPI_ID || "rohitchoudhary9323@oksbi";

// Twilio config (optional)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_PHONE_FROM = process.env.TWILIO_PHONE_FROM || "";
const ENABLE_TWILIO_SMS = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_FROM);

let twilioClient = null;
if (ENABLE_TWILIO_SMS) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  console.log("✅ Twilio SMS enabled");
} else {
  console.log("⚠️ Twilio SMS disabled — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_FROM to enable");
}

// MongoDB client
const url = MONGO_URL;
const client = new MongoClient(url, { useUnifiedTopology: true });
let connected = false;
async function connectDB() {
  if (!connected) {
    await client.connect();
    connected = true;
    console.log("✅ Connected to MongoDB");
  }
  return client.db(DB_NAME);
}

// ---------- ROUTES: signup/login (kept from your code) ----------
app.post("/signup", async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ error: "Mobile number must be exactly 10 digits." });
    }

    const db = await connectDB();
    const users = db.collection("users");

    const existing = await users.findOne({ $or: [{ email }, { mobile }] });
    if (existing) {
      return res.status(400).json({ error: "Email or mobile already registered" });
    }

    // NOTE: Hash passwords before storing in production (bcrypt)
    await users.insertOne({ name, email, mobile, password, role: "user", createdAt: new Date() });
    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/signup-mechanic", async (req, res) => {
  try {
    const { name, email, mobile, password, garageName } = req.body;
    if (!name || !email || !mobile || !password || !garageName) {
      return res.status(400).json({ error: "All fields are required for mechanic signup" });
    }
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ error: "Mobile number must be exactly 10 digits." });
    }

    const db = await connectDB();
    const mechanics = db.collection("mechanics");
    const mechanicLogins = db.collection("mechanic_logins");
    const users = db.collection("users");

    // check duplicates across collections
    const alreadyInMechanics = await mechanics.findOne({ $or: [{ email }, { mobile }] });
    const alreadyInUsers = await users.findOne({ $or: [{ email }, { mobile }] });
    if (alreadyInMechanics || alreadyInUsers) {
      return res.status(400).json({ error: "Email or mobile already registered" });
    }

    // === INLINE API KEY (DEV ONLY) ===
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || ""; // set in env for production
    if (!GOOGLE_API_KEY) {
      // Fallback behavior: allow signup but skip google place verification
      console.warn("Google API key not configured -- skipping place verification");
    }

    let place = null;
    if (GOOGLE_API_KEY) {
      // format phone to international (India): +91XXXXXXXXXX
      const intlPhone = `+91${mobile}`;

      const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
        intlPhone
      )}&inputtype=phonenumber&fields=place_id,name,formatted_address&key=${GOOGLE_API_KEY}`;

      try {
        const gpResp = await fetch(findPlaceUrl);
        const gpData = await gpResp.json();

        if (!gpData || gpData.status !== "OK" || !Array.isArray(gpData.candidates) || gpData.candidates.length === 0) {
          return res.status(400).json({
            error: "Phone number not found on Google Places — mechanics must verify a business phone.",
            googleStatus: gpData?.status ?? "NO_RESPONSE",
          });
        }
        place = gpData.candidates[0];
      } catch (err) {
        console.error("Google Places error:", err);
        return res.status(500).json({ error: "Google Places lookup failed" });
      }
    }

    const mechProfile = {
      name,
      email,
      mobile,
      garageName,
      googlePlaceId: place?.place_id || null,
      googlePlaceName: place?.name || null,
      googlePlaceAddress: place?.formatted_address || null,
      role: "mechanic",
      createdAt: new Date(),
    };

    const loginDoc = {
      mobile,
      email,
      password, // hash this in production
      role: "mechanic",
      createdAt: new Date(),
    };

    await mechanics.insertOne(mechProfile);
    await mechanicLogins.insertOne(loginDoc);

    res.json({ message: "Mechanic registered successfully", placeFound: place?.name || null });
  } catch (err) {
    console.error("Mechanic signup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const db = await connectDB();
    // first check users collection
    const users = db.collection("users");
    let user = await users.findOne({ email });

    // if not found in users, check mechanic_logins by email
    if (!user) {
      const mechanicLogins = db.collection("mechanic_logins");
      const mechLogin = await mechanicLogins.findOne({ email });
      if (mechLogin) {
        // attach some profile info from mechanics collection if needed
        const mechanics = db.collection("mechanics");
        const profile = await mechanics.findOne({ email });
        // simple password check (replace by bcrypt.compare in prod)
        if (mechLogin.password !== password) {
          return res.status(400).json({ error: "Invalid password" });
        }
        return res.json({ message: "✅ Login successful", user: { ...profile, role: "mechanic" } });
      }
      return res.status(400).json({ error: "User not found" });
    }

    // password check for regular user (plaintext here)
    if (user.password !== password) {
      return res.status(400).json({ error: "Invalid password" });
    }
    res.json({ message: "✅ Login successful", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===================== Socket.IO ===================== //
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] } });

const userSockets = new Map(); // key -> socketId

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("register", ({ role, id }) => {
    if (!role || !id) return;
    if (role === "user") {
      userSockets.set(id, socket.id);
      console.log(`Registered user ${id} -> ${socket.id}`);
    } else if (role === "mechanic") {
      socket.join("mechanics");
      console.log(`Registered mechanic ${id} and joined the 'mechanics' room.`);
    }
  });

  // NEW: online payment initiated (mechanic triggers so user receives payment request)
  socket.on("online-payment-initiated", async ({ requestId, amount, upi }) => {
    try {
      console.log("online-payment-initiated:", { requestId, amount, upi });

      const db = await connectDB();
      const requests = db.collection("requests");
      const payments = db.collection("payments"); // NEW payments collection

      const hex = (typeof requestId === "string") ? (ObjectId.isValid(requestId) ? requestId : null) : null;
      const reqDoc = hex ? await requests.findOne({ _id: new ObjectId(hex) }) : null;

      // create payment record (server-side)
      const paymentRecord = {
        requestId: hex,
        amount: Number(amount) || 0,
        upi: upi || DEFAULT_UPI_ID,
        status: "pending",
        createdAt: new Date(),
      };
      const pInsert = await payments.insertOne(paymentRecord);
      const paymentId = pInsert.insertedId;

      const userKey = reqDoc?.userEmail || reqDoc?.userId;
      if (userKey && userSockets.has(userKey)) {
        const userSocketId = userSockets.get(userKey);
        io.to(userSocketId).emit("payment-request", { requestId: hex, amount, upi: upi || DEFAULT_UPI_ID, paymentId: paymentId.toString() });
        console.log("Sent payment-request to user socket", userSocketId);
      } else {
        console.log("User socket not found for", userKey);
      }

      // Optionally send SMS if Twilio enabled and user phone available
      if (ENABLE_TWILIO_SMS) {
        // Prefer a phone number stored on the request doc, else fallback to users collection
        let userPhone = reqDoc?.userPhone || reqDoc?.mobile || null;
        if (!userPhone && reqDoc?.userId) {
          try {
            const users = db.collection("users");
            const u = await users.findOne({ _id: ObjectId.isValid(reqDoc.userId) ? new ObjectId(reqDoc.userId) : null });
            if (u?.mobile) userPhone = u.mobile;
          } catch (e) {
            // ignore
          }
        }

        if (userPhone) {
          // ensure E.164 format if it's exactly 10 digits, prefix with +91
          if (/^\d{10}$/.test(userPhone)) userPhone = `+91${userPhone}`;

          const upiToUse = upi || DEFAULT_UPI_ID;
          const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiToUse)}&pn=${encodeURIComponent(reqDoc?.userName || "FixNow")}&am=${encodeURIComponent(amount)}&cu=INR`;

          try {
            const smsBody = `Pay ₹${amount} via UPI to ${upiToUse}. Open: ${upiDeepLink}`;
            await twilioClient.messages.create({
              body: smsBody,
              from: TWILIO_PHONE_FROM,
              to: userPhone,
            });
            console.log("Sent SMS to user:", userPhone);
          } catch (smsErr) {
            console.error("Failed to send SMS via Twilio:", smsErr);
          }
        } else {
          console.log("No phone number available for request", requestId, "-- skipping SMS");
        }
      }

      // SIMULATION: auto-verify payment after 10s (replace with real PSP/webhook in production)
      setTimeout(async () => {
        try {
          // update payment record and requests.paymentStatus
          await payments.updateOne({ _id: paymentId }, { $set: { status: "verified", verifiedAt: new Date() } });
          if (hex) {
            await requests.updateOne({ _id: new ObjectId(hex) }, { $set: { paymentStatus: "paid", paymentMethod: "online", paidAt: new Date() } });
          }
          // notify both mechanic/user that payment verified
          io.emit("payment-status", { requestId: hex, status: "verified", method: "online", paymentId: paymentId.toString() });
          console.log("Auto-verified payment for request:", hex);
        } catch (autoErr) {
          console.error("Auto-verify failed:", autoErr);
        }
      }, 10000);
    } catch (err) {
      console.error("Error in online-payment-initiated handler:", err);
    }
  });

  // UI triggers a check for payment (mechanic asks server to check)
  socket.on("online-payment-check", ({ requestId }) => {
    console.log("online-payment-check for", requestId);
    // Here we simply broadcast that a check was requested — real verification is manual or via PSP webhook
    io.emit("payment-status", { requestId, status: "pending" });
  });

  // Mechanic or admin verifies payment
  socket.on("payment-verified", async ({ requestId, method = "online" }) => {
    console.log("payment-verified:", { requestId, method });
    try {
      const db = await connectDB();
      const requests = db.collection("requests");
      const payments = db.collection("payments");

      if (ObjectId.isValid(requestId)) {
        await requests.updateOne({ _id: new ObjectId(requestId) }, { $set: { paymentStatus: "paid", paymentMethod: method, paidAt: new Date() } });
      } else {
        console.warn("payment-verified: invalid requestId format:", requestId);
      }

      // Optionally update any pending payment record for that request
      try {
        await payments.updateOne({ requestId }, { $set: { status: "verified", verifiedAt: new Date() } });
      } catch (e) {
        // best-effort
      }
    } catch (e) {
      console.warn("Could not persist payment status:", e);
    }
    io.emit("payment-status", { requestId, status: "verified", method });
  });

  socket.on("disconnect", () => {
    for (const [key, sid] of userSockets.entries()) {
      if (sid === socket.id) userSockets.delete(key);
    }
    console.log("Socket disconnected:", socket.id);
  });
});
app.get("/mechanics", async (req, res) => {
  const { googleplacename } = req.query;
  if (!googleplacename) return res.status(400).json({ error: "Missing name" });

  const mechanics = await db.collection("mechanic").find({ googleplacename }).toArray();
  res.json(mechanics);
});
app.get("/mechanics", async (req, res) => {
  const { googleplacename } = req.query;
  if (!googleplacename) return res.status(400).json({ error: "Missing name" });

  const mechanics = await db.collection("mechanic").find({ googleplacename }).toArray();
  res.json(mechanics);
});

// ===================== Requests ===================== //
app.post("/requests", async (req, res) => {
  try {
    const { userId, userName, userEmail, vehicleType, vehicleName, issue, lat, lng } = req.body;
    if (!userEmail || !vehicleName || !issue) return res.status(400).json({ error: "userEmail, vehicleName and issue required" });

    const db = await connectDB();
    const requests = db.collection("requests");

    const doc = { userId: userId || null, userName, userEmail, vehicleType: vehicleType || "car", vehicleName, issue, location: lat && lng ? { lat, lng } : null, status: "pending", createdAt: new Date() };

    const r = await requests.insertOne(doc);
    const inserted = { ...doc, _id: r.insertedId };

    // Send to specific mechanic if specified
if (req.body.mechanicId && mechanicSockets.has(req.body.mechanicId)) {
  const mechSocketId = mechanicSockets.get(req.body.mechanicId);
  io.to(mechSocketId).emit("new-request", { request: inserted });
  console.log(`Sent request ${inserted._id} only to mechanic ${req.body.mechanicId}`);
} else {
  // Broadcast to all mechanics if no specific mechanic
  io.to("mechanics").emit("new-request", { request: inserted });
  console.log("Broadcasted 'new-request' to all mechanics");
}

res.json({ ok: true, request: inserted });


    res.json({ ok: true, request: inserted });
  } catch (err) {
    console.error("POST /requests error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET single request by id (useful for CompleteJobPage frontend)
app.get("/requests/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });

    const db = await connectDB();
    const requests = db.collection("requests");
    const doc = await requests.findOne({ _id: new ObjectId(id) });
    if (!doc) return res.status(404).json({ error: "Request not found" });
    res.json({ request: doc });
  } catch (err) {
    console.error("GET /requests/:id error", err);
    res.status(500).json({ error: "Server error" });
  }
});
//================history=============//
// SBack.js or your routes file
app.get("/mechanic/history", async (req, res) => {
  try {
    const db = await connectDB();
    const mechanicId = req.query.mechanicId;
    if (!mechanicId) return res.status(400).json({ error: "mechanicId is required" });

    const queryId = ObjectId.isValid(mechanicId) ? new ObjectId(mechanicId) : null;

    const history = await db.collection("requests")
      .find({
        $or: [
          { acceptedBy: mechanicId },       // string match
          ...(queryId ? [{ acceptedBy: queryId }] : []) // ObjectId match
        ]
      })
      .toArray();

    console.log("Fetching history for mechanicId:", mechanicId);
    console.log("Found history:", history.length, history.map(h => h._id.toString()));

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// GET /mechanic/reviews
// GET /mechanic/reviews?mechanicId=...
app.get("/mechanic/reviews", async (req, res) => {
  const db = await connectDB();
  const { mechanicId } = req.query;
  if (!mechanicId) return res.status(400).json({ error: "mechanicId is required" });

  try {
   
    const reviewsCollection = db.collection("reviews");

    const reviews = await reviewsCollection
      .find({ mechanicId: mechanicId.toString() })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(reviews);
  } catch (err) {
    console.error("Failed to fetch reviews:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("register", ({ role, id }) => {
    if (role === "admin") socket.join("admin");
    if (role === "mechanic") socket.join(id);
  });
});

app.set("io", io);

// ==================== MECHANIC ROUTES ====================

// GET /mechanic/earnings?mechanicId=...&filter=day|week|month|year|range&date=YYYY-MM-DD&month=YYYY-MM&year=YYYY&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
app.get("/mechanic/earnings", async (req, res) => {
  try {
    const db = await connectDB();
    const { mechanicId, filter } = req.query;
    if (!mechanicId) return res.status(400).json({ error: "mechanicId is required" });

    // parse date params
    const dateStr = req.query.date; // yyyy-mm-dd
    const monthStr = req.query.month; // yyyy-mm
    const yearStr = req.query.year; // yyyy
    const startDateStr = req.query.startDate;
    const endDateStr = req.query.endDate;

    // Build match condition on completedAt (or createdAt if completedAt missing).
    // We only count completed jobs. If you want to count paid only, add paymentStatus:'paid'
    const match = { status: "completed" };

    // acceptedBy may be stored as string or ObjectId — support both
    let mechQueryId = mechanicId;
    if (ObjectId.isValid(mechanicId)) {
      mechQueryId = new ObjectId(mechanicId);
      // We'll match either forms in $or
      match.$or = [
        { acceptedBy: mechQueryId },
        { acceptedBy: String(mechanicId) },
        { "mechanic._id": mechQueryId },
        { "mechanic._id": String(mechanicId) },
        { "mechanic.email": mechanicId },
        { mechanicId }, // maybe field mechanicId on request
      ];
    } else {
      match.$or = [
        { acceptedBy: mechanicId },
        { "mechanic._id": mechanicId },
        { "mechanic.email": mechanicId },
        { mechanicId },
      ];
    }

    // Determine start/end date (UTC)
    let start = null;
    let end = null;
    const toDate = (s) => {
      const d = new Date(s);
      if (isNaN(d)) return null;
      // normalize to start of day in UTC
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0));
    };

    if (filter === "day") {
      if (!dateStr) return res.status(400).json({ error: "date is required for day filter" });
      start = toDate(dateStr);
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
    } else if (filter === "week") {
      if (!dateStr) return res.status(400).json({ error: "date is required for week filter" });
      const d = new Date(dateStr);
      // get Monday as start (ISO) — adjust so week starts Monday
      const day = (d.getUTCDay() + 6) % 7; // 0=Monday ... 6=Sunday
      start = toDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)));
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
    } else if (filter === "month") {
      if (!monthStr) return res.status(400).json({ error: "month is required for month filter (YYYY-MM)" });
      const [yy, mm] = monthStr.split("-").map(Number);
      start = new Date(Date.UTC(yy, mm - 1, 1, 0, 0, 0));
      end = new Date(Date.UTC(yy, mm - 1 + 1, 1, 0, 0, 0));
    } else if (filter === "year") {
      if (!yearStr) return res.status(400).json({ error: "year is required for year filter (YYYY)" });
      const yy = Number(yearStr);
      start = new Date(Date.UTC(yy, 0, 1, 0, 0, 0));
      end = new Date(Date.UTC(yy + 1, 0, 1, 0, 0, 0));
    } else if (filter === "range") {
      if (!startDateStr || !endDateStr) return res.status(400).json({ error: "startDate and endDate are required for range filter" });
      start = toDate(startDateStr);
      // end should be next day after endDate inclusive
      end = toDate(endDateStr);
      if (!start || !end) return res.status(400).json({ error: "Invalid startDate/endDate" });
      end.setUTCDate(end.getUTCDate() + 1);
    } else {
      // default: return last 7 days
      end = new Date();
      end = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1));
      start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 7);
    }

    // Add completedAt range criteria. We'll check completedAt then fallback to createdAt in aggregation.
    const pipeline = [
      { $match: match },
      // add a field 'when' prefer completedAt else createdAt
      {
        $addFields: {
          when: {
            $ifNull: ["$completedAt", "$createdAt"]
          },
          amountNum: { $ifNull: [{ $toDouble: "$amount" }, 0] } // ensure numeric
        }
      },
      // filter by date range
      {
        $match: {
          when: { $gte: start, $lt: end }
        }
      },
      // projection of fields we need
      {
        $project: {
          _id: 1,
          userId: 1,
          userName: 1,
          userEmail: 1,
          issue: 1,
          amount: "$amountNum",
          when: 1,
          paymentStatus: 1,
          paymentMethod: 1
        }
      },
      { $sort: { when: -1 } }
    ];

    const docs = await db.collection("requests").aggregate(pipeline).toArray();

    // compute total
    const total = docs.reduce((s, d) => s + (Number(d.amount) || 0), 0);

    res.json({ entries: docs, total });
  } catch (err) {
    console.error("GET /mechanic/earnings error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// GET /user/history?userId=<id or email>
app.get("/user/history", async (req, res) => {
  try {
    const db = await connectDB();
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    // Support both ObjectId and string email
    const orClauses = [];
    if (ObjectId.isValid(userId)) {
      const obj = new ObjectId(userId);
      orClauses.push({ userId: obj }, { userId: String(userId) }, { userId: userId });
      // also try matching userEmail field
      orClauses.push({ userEmail: { $regex: new RegExp(`^${userId}$`, "i") } });
    } else {
      orClauses.push({ userEmail: userId }, { userId: userId });
    }

    // Only return completed or all? Here we return all requests for the user,
    // you can add { status: "completed" } if you want only finished jobs.
    const docs = await db.collection("requests")
      .find({ $or: orClauses })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(docs);
  } catch (err) {
    console.error("GET /user/history error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ===================== Mechanic Accept via HTTP ===================== //
// ===================== Mechanic Accept via HTTP ===================== //
app.post("/mechanic/requests/:id/accept", async (req, res) => {
  try {
    const requestId = req.params.id;
    const { mechanicId, mechanicEmail } = req.body;
    const db = await connectDB();
    const requests = db.collection("requests");

    // Validate request ID
    if (!ObjectId.isValid(requestId)) return res.status(400).json({ error: "Invalid Request ID format." });
    const objectId = new ObjectId(requestId);

    const reqDoc = await requests.findOne({ _id: objectId });
    if (!reqDoc) return res.status(404).json({ error: "Request not found" });
    if (reqDoc.status === "accepted") return res.status(400).json({ error: "Already accepted" });

    // Convert mechanicId to ObjectId if valid
    const mechId = ObjectId.isValid(mechanicId) ? new ObjectId(mechanicId) : null;

    // Update request with acceptedBy as ObjectId
    await requests.updateOne(
      { _id: objectId },
      { $set: { status: "accepted", acceptedBy: mechId || mechanicEmail, acceptedAt: new Date() } }
    );

    console.log(`Broadcasting that request ${requestId} has been claimed...`);
    io.to("mechanics").emit("request-claimed", { requestId });

    // Fetch mechanic profile
    const mechanics = db.collection("mechanics");
    let mechanicProfile = null;
    if (mechId) mechanicProfile = await mechanics.findOne({ _id: mechId });
    else if (mechanicEmail) mechanicProfile = await mechanics.findOne({ email: mechanicEmail });

    // Notify user
    const userKey = reqDoc.userEmail || reqDoc.userId;
    const socketId = userSockets.get(userKey);
    if (socketId) io.to(socketId).emit("request-accepted", { mechanicAccepted: mechanicProfile || { name: "Mechanic", email: mechanicEmail }, userRequest: reqDoc });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// ===================== Mechanic Online/Offline ===================== //
app.get("/mechanic/status", async (req, res) => {
  try {
    const { mechanicId } = req.query;
    if (!mechanicId) return res.status(400).json({ error: "mechanicId required" });

    const db = await connectDB();
    const mechanics = db.collection("mechanics");
    const mech = await mechanics.findOne({
      $or: [
        { _id: ObjectId.isValid(mechanicId) ? new ObjectId(mechanicId) : null },
        { email: mechanicId },
      ],
    });

    if (!mech) return res.status(404).json({ error: "Mechanic not found" });
    res.json({ online: mech.online ?? false });
  } catch (err) {
    console.error("GET /mechanic/status error", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/mechanic/status", async (req, res) => {
  try {
    const { mechanicId, online } = req.body;
    if (!mechanicId) return res.status(400).json({ error: "mechanicId required" });

    const db = await connectDB();
    const mechanics = db.collection("mechanics");
    const filter = ObjectId.isValid(mechanicId) ? { _id: new ObjectId(mechanicId) } : { email: mechanicId };
    await mechanics.updateOne(filter, { $set: { online: !!online } });

    res.json({ ok: true, online: !!online });
  } catch (err) {
    console.error("POST /mechanic/status error", err);
    res.status(500).json({ error: "Server error" });
  }
});
// in server file (SBack.js)
app.post("/contact", async (req, res) => {
  try {
    const db = await connectDB();
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !subject || !message) return res.status(400).json({ error: "Missing fields" });

    await db.collection("contacts").insertOne({ name, email, phone, subject, message, createdAt: new Date() });

    // optionally send email via SMTP or Twilio SendGrid here
    res.json({ ok: true, message: "Received" });
  } catch (err) {
    console.error("POST /contact error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===================== Complete Job endpoint (updated) ===================== //
app.post("/api/complete-job/:id", async (req, res) => {
  const payload = req.body;
  let { id } = req.params;

  console.log("Received complete job request (raw):", JSON.stringify(id));
  const normalizeId = (raw) => {
    if (!raw) return null;
    const s = raw.toString().trim();
    const m = s.match(/ObjectId\(["']?([a-fA-F0-9]{24})["']?\)/);
    if (m) return m[1];
    if (/^[a-fA-F0-9]{24}$/.test(s)) return s;
    const m2 = s.match(/([a-fA-F0-9]{24})/);
    if (m2) return m2[1];
    return null;
  };
  const hexId = normalizeId(id);
  if (!hexId) return res.status(400).json({ success: false, message: "Invalid job ID" });

  const problemsFromClient = Array.isArray(payload.problems) ? payload.problems : null;
  if (!problemsFromClient || problemsFromClient.length === 0) {
    return res.status(400).json({ success: false, message: "No problems submitted" });
  }

  try {
    const db = await connectDB();
    const requests = db.collection("requests");
    const problemsColl = db.collection("problems");

    const objectId = new ObjectId(hexId);

    // Fetch preset problem docs
    const presetProblemIds = problemsFromClient
      .filter((p) => p.type === "preset" && p.problemId)
      .map((p) => {
        try {
          return new ObjectId(p.problemId);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    const presetDocs = presetProblemIds.length > 0 ? await problemsColl.find({ _id: { $in: presetProblemIds } }).toArray() : [];

    const presetMap = {};
    for (const d of presetDocs) presetMap[d._id.toString()] = d;

    // Validate and build server-side breakdown
    const breakdown = [];
    let total = 0;

    for (const p of problemsFromClient) {
      if (p.type === "preset") {
        if (!p.problemId || !presetMap[p.problemId]) {
          return res.status(400).json({ success: false, message: `Invalid preset problem id: ${p.problemId}` });
        }
        const doc = presetMap[p.problemId];
        const amt = Number(doc.amount || 0);
        breakdown.push({ type: "preset", problemId: doc._id.toString(), title: doc.title, amount: amt });
        total += amt;
      } else if (p.type === "other") {
        const title = (p.title || "").toString().trim();
        const amt = Number(p.amount);
        if (!title || !isFinite(amt) || amt < 0) {
          return res.status(400).json({ success: false, message: "Invalid other problem entry." });
        }
        breakdown.push({ type: "other", title, amount: amt });
        total += amt;
      } else {
        return res.status(400).json({ success: false, message: "Unknown problem type" });
      }
    }

    // Update request doc
    const update = {
      $set: {
        status: "completed",
        amount: total,
        problemsBreakdown: breakdown,
        completedAt: new Date(),
      },
    };

    let result;
    try {
      // modern driver: returnDocument: "after"
      result = await requests.findOneAndUpdate({ _id: objectId }, update, { returnDocument: "after" });
    } catch (errInner) {
      console.warn("returnDocument failed, fallback to returnOriginal:", errInner?.message || errInner);
      result = await requests.findOneAndUpdate({ _id: objectId }, update, { returnOriginal: false });
    }

    console.log("🔹 Update result:", result);
    const updatedDoc = (result && (result.value ?? result)) || null;
    if (!updatedDoc) return res.status(404).json({ success: false, message: "Job not found", id: hexId });

    // Emit structured job-completed event with breakdown & total
    io.emit("job-completed", { requestId: hexId, amount: total, breakdown });
    console.log("✅ Job completed successfully:", updatedDoc);

    return res.status(200).json({ success: true, job: updatedDoc });
  } catch (err) {
    console.error("❌ Error completing job:", err);
    return res.status(500).json({ success: false, message: "Server error", detail: err.message });
  }
});

// GET /problems?vehicleType=car
app.get("/problems", async (req, res) => {
  try {
    const vehicleType = (req.query.vehicleType || "").toString().trim().toLowerCase();
    const db = await connectDB();
    const problems = db.collection("problems");
    const query = vehicleType ? { vehicleType } : {};
    const docs = await problems.find(query).sort({ createdAt: 1 }).toArray();
    res.json({ success: true, problems: docs });
  } catch (err) {
    console.error("GET /problems error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /problems  (optional: admin endpoint to add new standard problems)
app.post("/problems", async (req, res) => {
  try {
    const { vehicleType, code, title, amount } = req.body;
    if (!vehicleType || !code || !title || typeof amount !== "number") {
      return res.status(400).json({ success: false, message: "vehicleType, code, title and numeric amount required" });
    }
    const db = await connectDB();
    const problems = db.collection("problems");
    const existing = await problems.findOne({ vehicleType, code });
    if (existing) return res.status(400).json({ success: false, message: "Problem code already exists for this vehicle type" });

    const r = await problems.insertOne({ vehicleType, code, title, amount, createdAt: new Date() });
    res.json({ success: true, problem: { _id: r.insertedId, vehicleType, code, title, amount } });
  } catch (err) {
    console.error("POST /problems error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Optional: trigger SMS for testing
app.post("/send-payment-sms/:requestId", async (req, res) => {
  if (!ENABLE_TWILIO_SMS) return res.status(500).json({ ok: false, message: "Twilio not configured" });
  const { requestId } = req.params;
  const { upi = DEFAULT_UPI_ID, amount } = req.body || {};

  try {
    const db = await connectDB();
    const requests = db.collection("requests");
    const doc = await requests.findOne({ _id: ObjectId.isValid(requestId) ? new ObjectId(requestId) : null });
    if (!doc) return res.status(404).json({ ok: false, message: "Request not found" });

    // find a phone
    let userPhone = doc.userPhone || doc.mobile || null;
    if (!userPhone && doc.userId) {
      const users = db.collection("users");
      const u = await users.findOne({ _id: ObjectId.isValid(doc.userId) ? new ObjectId(doc.userId) : null });
      if (u?.mobile) userPhone = u.mobile;
    }
    if (!userPhone) return res.status(400).json({ ok: false, message: "No phone for user" });

    if (/^\d{10}$/.test(userPhone)) userPhone = `+91${userPhone}`;

    const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(doc.userName || "FixNow")}&am=${encodeURIComponent(amount || "")}&cu=INR`;
    const smsBody = `Pay ₹${amount} via UPI: ${upi}. Open: ${upiDeepLink}`;

    await twilioClient.messages.create({ body: smsBody, from: TWILIO_PHONE_FROM, to: userPhone });
    return res.json({ ok: true });
  } catch (err) {
    console.error("send-payment-sms error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /reviews
app.post("/reviews", async (req, res) => {
  try {
    const { jobId, mechanicId, userId, rating, review } = req.body;
    if (!jobId || !mechanicId || !userId || !rating || !review) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }
    const db = await connectDB();
    const reviews = db.collection("reviews");

    const r = await reviews.insertOne({
      jobId,
      mechanicId,
      userId,
      rating: Number(rating),
      review,
      createdAt: new Date(),
    });

    res.json({ success: true, reviewId: r.insertedId });
  } catch (err) {
    console.error("POST /reviews error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===================== Start Server ===================== //
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));


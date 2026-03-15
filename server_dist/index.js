var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import OpenAI from "openai";

// server/db.ts
import { Pool } from "pg";
var pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// server/stripeClient.ts
import Stripe from "stripe";
var _stripe = null;
function getStripeKey() {
  return process.env.STRIPE_SECRET_KEY;
}
function getStripeClient() {
  const key = getStripeKey();
  if (!key) throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" });
  }
  return _stripe;
}
function isStripeConfigured() {
  return !!getStripeKey();
}
async function createCheckoutSession(opts) {
  const stripe = getStripeClient();
  const amountCents = Math.round(opts.amount * 100);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `HOA Dues \u2014 ${opts.period}`,
            description: "Beyond HOA Community Association"
          },
          unit_amount: amountCents
        },
        quantity: 1
      }
    ],
    metadata: {
      dues_id: opts.duesId,
      period: opts.period
    }
  });
  if (!session.url) throw new Error("No checkout URL returned from Stripe");
  return { url: session.url, sessionId: session.id };
}
async function retrieveCheckoutSession(sessionId) {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return {
    paymentStatus: session.payment_status,
    paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
    metadata: session.metadata ?? {}
  };
}

// server/routes.ts
var openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});
var BYLAW_SYSTEM_PROMPT = `You are an expert HOA (Homeowners Association) Bylaw Assistant. You help residents and board members understand their HOA rules, regulations, and bylaws.

You are knowledgeable about:
- Common HOA covenants, conditions, and restrictions (CC&Rs)
- Architectural review processes and approval requirements
- Maintenance and landscaping standards
- Pet policies and noise regulations
- Parking rules and vehicle restrictions
- Common area usage rules
- Assessment and dues collection procedures
- Violation and enforcement procedures
- Meeting procedures (quorum, voting, special assessments)
- Board member roles and responsibilities
- Dispute resolution processes
- Fair Housing Act compliance

When answering questions:
- Be clear, concise, and helpful
- Explain legal concepts in plain language
- Note when professional legal advice should be sought
- Acknowledge that specific HOA rules vary by community
- Suggest checking official HOA documents for specific rules

You represent a friendly, knowledgeable advisor helping community members navigate HOA life.`;
async function registerRoutes(app2) {
  app2.post("/api/bylaw-chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const stream = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: BYLAW_SYSTEM_PROMPT },
          ...messages
        ],
        stream: true,
        max_completion_tokens: 8192
      });
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}

`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}

`);
      res.end();
    } catch (error) {
      console.error("Bylaw chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to get response" })}

`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process request" });
      }
    }
  });
  app2.get("/api/residents", async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM residents ORDER BY unit ASC"
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Residents fetch error:", err);
      res.status(500).json({ error: "Failed to fetch residents" });
    }
  });
  app2.post("/api/residents", async (req, res) => {
    try {
      const { name, unit, email, phone, status, move_in_date, notes } = req.body;
      if (!name || !unit || !status) {
        return res.status(400).json({ error: "name, unit, and status are required" });
      }
      const result = await pool.query(
        `INSERT INTO residents (name, unit, email, phone, status, move_in_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [name, unit, email || null, phone || null, status, move_in_date || null, notes || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Resident create error:", err);
      res.status(500).json({ error: "Failed to create resident" });
    }
  });
  app2.put("/api/residents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, unit, email, phone, status, move_in_date, notes } = req.body;
      const result = await pool.query(
        `UPDATE residents SET name=$1, unit=$2, email=$3, phone=$4, status=$5, move_in_date=$6, notes=$7
         WHERE id=$8 RETURNING *`,
        [name, unit, email || null, phone || null, status, move_in_date || null, notes || null, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Resident update error:", err);
      res.status(500).json({ error: "Failed to update resident" });
    }
  });
  app2.delete("/api/residents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM residents WHERE id=$1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Resident delete error:", err);
      res.status(500).json({ error: "Failed to delete resident" });
    }
  });
  app2.get("/api/violations", async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM violations ORDER BY created_at DESC"
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Violations fetch error:", err);
      res.status(500).json({ error: "Failed to fetch violations" });
    }
  });
  app2.post("/api/violations", async (req, res) => {
    try {
      const {
        resident_name,
        unit,
        violation_type,
        notice_number,
        incident_date,
        description,
        required_action,
        compliance_deadline,
        fine_amount,
        notes,
        issued_by
      } = req.body;
      if (!resident_name || !unit || !violation_type || !incident_date || !description || !required_action || !compliance_deadline) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const result = await pool.query(
        `INSERT INTO violations
          (resident_name, unit, violation_type, notice_number, incident_date, description, required_action, compliance_deadline, fine_amount, notes, issued_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open') RETURNING *`,
        [resident_name, unit, violation_type, notice_number || 1, incident_date, description, required_action, compliance_deadline, fine_amount || null, notes || null, issued_by || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Violation create error:", err);
      res.status(500).json({ error: "Failed to create violation" });
    }
  });
  app2.put("/api/violations/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!["open", "resolved", "appealed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const result = await pool.query(
        "UPDATE violations SET status=$1 WHERE id=$2 RETURNING *",
        [status, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Violation status error:", err);
      res.status(500).json({ error: "Failed to update violation" });
    }
  });
  app2.delete("/api/violations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM violations WHERE id=$1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Violation delete error:", err);
      res.status(500).json({ error: "Failed to delete violation" });
    }
  });
  app2.get("/api/work-orders", async (req, res) => {
    try {
      const { unit } = req.query;
      let query = "SELECT * FROM work_orders";
      const params = [];
      if (unit) {
        query += " WHERE unit=$1";
        params.push(unit);
      }
      query += " ORDER BY created_at DESC";
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error("Work orders fetch error:", err);
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });
  app2.post("/api/work-orders", async (req, res) => {
    try {
      const { title, resident_name, unit, category, priority, description } = req.body;
      if (!title || !resident_name || !unit || !category || !description) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const result = await pool.query(
        `INSERT INTO work_orders (title, resident_name, unit, category, priority, description)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [title, resident_name, unit, category, priority || "medium", description]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Work order create error:", err);
      res.status(500).json({ error: "Failed to create work order" });
    }
  });
  app2.put("/api/work-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, board_notes } = req.body;
      const validStatuses = ["submitted", "in-progress", "completed", "cancelled"];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const result = await pool.query(
        `UPDATE work_orders SET status=COALESCE($1,status), board_notes=COALESCE($2,board_notes), updated_at=NOW()
         WHERE id=$3 RETURNING *`,
        [status || null, board_notes ?? null, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Work order update error:", err);
      res.status(500).json({ error: "Failed to update work order" });
    }
  });
  app2.delete("/api/work-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM work_orders WHERE id=$1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Work order delete error:", err);
      res.status(500).json({ error: "Failed to delete work order" });
    }
  });
  app2.get("/documents/budget-2026", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "budget-2026.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/documents/minutes-q4-2025", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "minutes-q4-2025.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/documents/minutes-q3-2025", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "minutes-q3-2025.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/documents/bylaws-2024", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "bylaws-2024.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/documents/rules-regulations", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "rules-regulations.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/documents/architectural-guidelines", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "architectural-guidelines.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/documents/financial-report-2025", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "financial-report-2025.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/documents/ccrs-declaration", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "ccrs-declaration.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/documents/reserve-study-2024", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "reserve-study-2024.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/documents/pet-policy", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "pet-policy.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/documents/architectural-request-form", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "architectural-request-form.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/documents/move-in-out-form", (_req, res) => {
    const filePath = __require("path").resolve(process.cwd(), "server", "templates", "move-in-out-form.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });
  app2.get("/api/dues/stripe-configured", (_req, res) => {
    res.json({ configured: isStripeConfigured() });
  });
  app2.post("/api/dues/checkout", async (req, res) => {
    try {
      const { duesId, period, amount } = req.body;
      if (!duesId || !period || !amount) {
        return res.status(400).json({ error: "duesId, period, and amount are required" });
      }
      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? req.get("host");
      const base = `https://${domain}`;
      const successUrl = `${base}/api/dues/payment-success?session_id={CHECKOUT_SESSION_ID}&dues_id=${duesId}`;
      const cancelUrl = `${base}/api/dues/payment-cancelled`;
      const { url, sessionId } = await createCheckoutSession({
        duesId: String(duesId),
        period: String(period),
        amount: Number(amount),
        successUrl,
        cancelUrl
      });
      await pool.query(
        `INSERT INTO dues_payments (dues_id, period, amount, stripe_session_id, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT (stripe_session_id) DO NOTHING`,
        [String(duesId), String(period), Number(amount), sessionId]
      );
      res.json({ url, sessionId });
    } catch (err) {
      console.error("Dues checkout error:", err);
      res.status(500).json({ error: err.message ?? "Failed to create checkout session" });
    }
  });
  app2.get("/api/dues/payment-success", async (req, res) => {
    const { session_id, dues_id } = req.query;
    try {
      if (session_id) {
        const { paymentStatus, paymentIntentId } = await retrieveCheckoutSession(session_id);
        if (paymentStatus === "paid") {
          await pool.query(
            `UPDATE dues_payments SET status='paid', stripe_payment_intent_id=$1, paid_at=NOW()
             WHERE stripe_session_id=$2`,
            [paymentIntentId, session_id]
          );
        }
      }
    } catch (err) {
      console.error("Payment success verification error:", err);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful \u2013 Beyond HOA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F5F6FA; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 20px; padding: 40px 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
    .icon { width: 72px; height: 72px; background: #e8f8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .icon svg { width: 36px; height: 36px; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #C9A84C; text-transform: uppercase; margin-bottom: 12px; }
    h1 { font-size: 26px; font-weight: 700; color: #0F2340; margin-bottom: 10px; }
    p { font-size: 15px; color: #6B7280; line-height: 1.6; margin-bottom: 28px; }
    .back-btn { display: inline-block; background: #0F2340; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-size: 15px; font-weight: 600; }
    .note { font-size: 12px; color: #9CA3AF; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <div class="brand">Beyond HOA</div>
    <h1>Payment Successful</h1>
    <p>Your HOA dues payment has been processed and your account has been updated. Thank you!</p>
    <a href="javascript:window.close()" class="back-btn">Return to App</a>
    <p class="note">You can close this window and return to the Beyond HOA app to see your updated payment status.</p>
  </div>
</body>
</html>`);
  });
  app2.get("/api/dues/payment-cancelled", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Cancelled \u2013 Beyond HOA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F5F6FA; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 20px; padding: 40px 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
    .icon { width: 72px; height: 72px; background: #FEF2F2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .icon svg { width: 36px; height: 36px; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #C9A84C; text-transform: uppercase; margin-bottom: 12px; }
    h1 { font-size: 26px; font-weight: 700; color: #0F2340; margin-bottom: 10px; }
    p { font-size: 15px; color: #6B7280; line-height: 1.6; margin-bottom: 28px; }
    .back-btn { display: inline-block; background: #0F2340; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-size: 15px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </div>
    <div class="brand">Beyond HOA</div>
    <h1>Payment Cancelled</h1>
    <p>Your payment was not completed. No charges have been made. You can try again from the app.</p>
    <a href="javascript:window.close()" class="back-btn">Return to App</a>
  </div>
</body>
</html>`);
  });
  app2.get("/api/dues/payments", async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM dues_payments ORDER BY created_at DESC"
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Dues payments fetch error:", err);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });
  app2.get("/api/dues/payment-status/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const dbResult = await pool.query(
        "SELECT * FROM dues_payments WHERE stripe_session_id=$1",
        [sessionId]
      );
      if (dbResult.rows.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }
      const record = dbResult.rows[0];
      if (record.status !== "paid") {
        try {
          const { paymentStatus, paymentIntentId } = await retrieveCheckoutSession(sessionId);
          if (paymentStatus === "paid") {
            await pool.query(
              `UPDATE dues_payments SET status='paid', stripe_payment_intent_id=$1, paid_at=NOW()
               WHERE stripe_session_id=$2`,
              [paymentIntentId, sessionId]
            );
            record.status = "paid";
          }
        } catch (stripeErr) {
          console.error("Stripe session check error:", stripeErr);
        }
      }
      res.json(record);
    } catch (err) {
      console.error("Payment status error:", err);
      res.status(500).json({ error: "Failed to check payment status" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();

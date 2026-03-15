import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import OpenAI from "openai";
import { pool } from "./db";
import { createCheckoutSession, retrieveCheckoutSession, isStripeConfigured } from "./stripeClient";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function templatePath(name: string): string {
  return resolvePath(__dirname, "..", "server", "templates", name);
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const BYLAW_SYSTEM_PROMPT = `You are an expert HOA (Homeowners Association) Bylaw Assistant. You help residents and board members understand their HOA rules, regulations, and bylaws.

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

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/bylaw-chat", async (req, res) => {
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
          ...messages,
        ],
        stream: true,
        max_completion_tokens: 8192,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Bylaw chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to get response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process request" });
      }
    }
  });

  app.get("/api/residents", async (_req, res) => {
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

  app.post("/api/residents", async (req, res) => {
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

  app.put("/api/residents/:id", async (req, res) => {
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

  app.delete("/api/residents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM residents WHERE id=$1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Resident delete error:", err);
      res.status(500).json({ error: "Failed to delete resident" });
    }
  });

  app.get("/api/violations", async (_req, res) => {
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

  app.post("/api/violations", async (req, res) => {
    try {
      const {
        resident_name, unit, violation_type, notice_number,
        incident_date, description, required_action, compliance_deadline,
        fine_amount, notes, issued_by,
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

  app.put("/api/violations/:id/status", async (req, res) => {
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

  app.delete("/api/violations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM violations WHERE id=$1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Violation delete error:", err);
      res.status(500).json({ error: "Failed to delete violation" });
    }
  });

  app.get("/api/work-orders", async (req, res) => {
    try {
      const { unit } = req.query;
      let query = "SELECT * FROM work_orders";
      const params: string[] = [];
      if (unit) { query += " WHERE unit=$1"; params.push(unit as string); }
      query += " ORDER BY created_at DESC";
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error("Work orders fetch error:", err);
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });

  app.post("/api/work-orders", async (req, res) => {
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

  app.put("/api/work-orders/:id", async (req, res) => {
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

  app.delete("/api/work-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM work_orders WHERE id=$1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Work order delete error:", err);
      res.status(500).json({ error: "Failed to delete work order" });
    }
  });

  app.get("/documents/budget-2026", (_req, res) => {
    const filePath = templatePath("budget-2026.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/documents/minutes-q4-2025", (_req, res) => {
    const filePath = templatePath("minutes-q4-2025.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/documents/minutes-q3-2025", (_req, res) => {
    const filePath = templatePath("minutes-q3-2025.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/documents/bylaws-2024", (_req, res) => {
    const filePath = templatePath("bylaws-2024.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/documents/rules-regulations", (_req, res) => {
    const filePath = templatePath("rules-regulations.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/documents/architectural-guidelines", (_req, res) => {
    const filePath = templatePath("architectural-guidelines.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/documents/financial-report-2025", (_req, res) => {
    const filePath = templatePath("financial-report-2025.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/documents/ccrs-declaration", (_req, res) => {
    const filePath = templatePath("ccrs-declaration.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/documents/reserve-study-2024", (_req, res) => {
    const filePath = templatePath("reserve-study-2024.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/documents/pet-policy", (_req, res) => {
    const filePath = templatePath("pet-policy.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/documents/architectural-request-form", (_req, res) => {
    const filePath = templatePath("architectural-request-form.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  app.get("/documents/move-in-out-form", (_req, res) => {
    const filePath = templatePath("move-in-out-form.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(filePath);
  });

  // ── DUES PAYMENTS ──────────────────────────────────────────────────────────

  app.get("/api/dues/stripe-configured", (_req, res) => {
    res.json({ configured: isStripeConfigured() });
  });

  app.post("/api/dues/checkout", async (req, res) => {
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
        cancelUrl,
      });

      await pool.query(
        `INSERT INTO dues_payments (dues_id, period, amount, stripe_session_id, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT (stripe_session_id) DO NOTHING`,
        [String(duesId), String(period), Number(amount), sessionId]
      );

      res.json({ url, sessionId });
    } catch (err: any) {
      console.error("Dues checkout error:", err);
      res.status(500).json({ error: err.message ?? "Failed to create checkout session" });
    }
  });

  app.get("/api/dues/payment-success", async (req, res) => {
    const { session_id, dues_id } = req.query as Record<string, string>;
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
  <title>Payment Successful – Beyond HOA</title>
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

  app.get("/api/dues/payment-cancelled", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Cancelled – Beyond HOA</title>
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

  app.get("/api/dues/payments", async (_req, res) => {
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

  app.get("/api/dues/payment-status/:sessionId", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}

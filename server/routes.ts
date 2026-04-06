import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import OpenAI from "openai";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./db";

const JWT_SECRET = process.env.SESSION_SECRET || "beyond-hoa-secret-key";
const DEFAULT_PASSWORD = "Welcome1!";

interface JwtPayload {
  residentId: number;
  email: string;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).residentId = payload.residentId;
    (req as any).email = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
import { createCheckoutSession, retrieveCheckoutSession, isStripeConfigured, resetStripeSync } from "./stripeClient";

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
  // ── Auth migration ──────────────────────────────────────────
  await pool.query(`
    ALTER TABLE residents ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
  `);
  // Set default password for residents that don't have one yet
  const noPassword = await pool.query(
    "SELECT id FROM residents WHERE password_hash IS NULL"
  );
  if (noPassword.rowCount && noPassword.rowCount > 0) {
    const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    await pool.query(
      "UPDATE residents SET password_hash=$1 WHERE password_hash IS NULL",
      [defaultHash]
    );
    console.log(`Set default password for ${noPassword.rowCount} resident(s)`);
  }

  // ── Auth routes ─────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const result = await pool.query(
        "SELECT * FROM residents WHERE LOWER(email)=LOWER($1)",
        [email.trim()]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const resident = result.rows[0];
      if (!resident.password_hash) {
        return res.status(401).json({ error: "Account not set up. Contact your HOA admin." });
      }
      const valid = await bcrypt.compare(password, resident.password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const token = jwt.sign(
        { residentId: resident.id, email: resident.email } as JwtPayload,
        JWT_SECRET,
        { expiresIn: "30d" }
      );
      const { password_hash: _ph, ...safeResident } = resident;
      res.json({ token, resident: safeResident });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const residentId = (req as any).residentId;
      const result = await pool.query(
        "SELECT id, name, unit, email, phone, status, move_in_date, notes, created_at FROM residents WHERE id=$1",
        [residentId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Resident not found" });
      }
      res.json({ resident: result.rows[0] });
    } catch (err) {
      console.error("Auth me error:", err);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const residentId = (req as any).residentId;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Both current and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }
      const result = await pool.query(
        "SELECT password_hash FROM residents WHERE id=$1",
        [residentId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Resident not found" });
      }
      const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      const newHash = await bcrypt.hash(newPassword, 10);
      await pool.query(
        "UPDATE residents SET password_hash=$1 WHERE id=$2",
        [newHash, residentId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Change password error:", err);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ── Board: set/reset resident password ──────────────────────
  app.post("/api/residents/:id/reset-password", async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      const pwd = newPassword || DEFAULT_PASSWORD;
      const hash = await bcrypt.hash(pwd, 10);
      const result = await pool.query(
        "UPDATE residents SET password_hash=$1 WHERE id=$2 RETURNING id",
        [hash, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
      res.json({ success: true, password: pwd });
    } catch (err) {
      console.error("Reset password error:", err);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

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
      const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      const result = await pool.query(
        `INSERT INTO residents (name, unit, email, phone, status, move_in_date, notes, password_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [name, unit, email || null, phone || null, status, move_in_date || null, notes || null, defaultHash]
      );
      const { password_hash: _ph, ...safeResident } = result.rows[0];
      res.status(201).json(safeResident);
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
        fine_amount, notes, issued_by, photo_url, assigned_vendor,
      } = req.body;
      if (!resident_name || !unit || !violation_type || !incident_date || !description || !required_action || !compliance_deadline) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const result = await pool.query(
        `INSERT INTO violations
          (resident_name, unit, violation_type, notice_number, incident_date, description, required_action,
           compliance_deadline, fine_amount, notes, issued_by, photo_url, assigned_vendor, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'open') RETURNING *`,
        [resident_name, unit, violation_type, notice_number || 1, incident_date, description, required_action,
         compliance_deadline, fine_amount || null, notes || null, issued_by || null,
         photo_url || null, assigned_vendor || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Violation create error:", err);
      res.status(500).json({ error: "Failed to create violation" });
    }
  });

  app.post("/api/violations/analyze-image", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;
      if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" });

      const systemPrompt = `You are an HOA compliance agent. Analyze the provided photo of a potential HOA violation.
Return a JSON object with exactly these fields:
{
  "violation_type": one of ["Landscaping / Lawn Care","Parking Violation","Noise / Nuisance","Pet Policy","Architectural Modification","Trash / Debris","Common Area Misuse","Short-Term Rental","Other"],
  "description": "2-3 sentence factual description of what is observed in the photo that constitutes the violation",
  "required_action": "specific action the resident must take to remedy the violation",
  "severity": one of ["low","medium","high"],
  "fine_suggestion": numeric dollar amount (e.g. 100, 250, 500) or null,
  "compliance_days": number of days to remedy (typically 7, 14, or 30),
  "summary": "one-line summary for the notice title"
}
Be specific, professional, and factual. Only return valid JSON.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
              },
            ],
          },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ error: "Could not parse AI response" });
      const analysis = JSON.parse(jsonMatch[0]);
      res.json(analysis);
    } catch (err) {
      console.error("Violation image analysis error:", err);
      res.status(500).json({ error: "Failed to analyze image" });
    }
  });

  app.get("/api/vendors", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM vendors WHERE active=TRUE ORDER BY name ASC");
      res.json(result.rows);
    } catch (err) {
      console.error("Vendors fetch error:", err);
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  app.post("/api/vendors", async (req, res) => {
    try {
      const { name, specialty, phone, email } = req.body;
      if (!name || !specialty) return res.status(400).json({ error: "name and specialty required" });
      const result = await pool.query(
        "INSERT INTO vendors (name, specialty, phone, email) VALUES ($1,$2,$3,$4) RETURNING *",
        [name, specialty, phone || null, email || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Vendor create error:", err);
      res.status(500).json({ error: "Failed to create vendor" });
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

  // ── Documents ────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('bylaws','rules','minutes','financial','forms','legal')),
      doc_date DATE NOT NULL,
      file_size TEXT,
      description TEXT,
      doc_path TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rowCount: docCount } = await pool.query("SELECT 1 FROM documents LIMIT 1");
  if ((docCount ?? 0) === 0) {
    await pool.query(`
      INSERT INTO documents (title, category, doc_date, file_size, description, doc_path) VALUES
        ('HOA Bylaws – 2024 Revision',       'bylaws',    '2024-01-15', '1.2 MB',  'Governing bylaws for Beyond HOA, revised January 2024.',                              '/documents/bylaws-2024'),
        ('Community Rules & Regulations',    'rules',     '2024-03-01', '856 KB',  'Complete rules covering landscaping, parking, noise, and pets.',                      '/documents/rules-regulations'),
        ('Architectural Review Guidelines',  'rules',     '2023-11-10', '432 KB',  'Standards and approval process for exterior modifications.',                          '/documents/architectural-guidelines'),
        ('Q4 2025 Board Meeting Minutes',    'minutes',   '2025-12-20', '124 KB',  'Official minutes from the December quarterly board meeting.',                         '/documents/minutes-q4-2025'),
        ('Q3 2025 Board Meeting Minutes',    'minutes',   '2025-09-18', '118 KB',  'Official minutes from the September quarterly board meeting.',                        '/documents/minutes-q3-2025'),
        ('Annual Financial Report 2025',     'financial', '2026-01-31', '2.1 MB',  'Year-end financial statements and budget overview for 2025.',                         '/documents/financial-report-2025'),
        ('2026 Operating Budget',            'financial', '2025-12-01', '445 KB',  'Approved operating and reserve budget for fiscal year 2026.',                         '/documents/budget-2026'),
        ('Architectural Request Form',       'forms',     '2024-01-01', '88 KB',   'Submit for any exterior changes requiring board approval.',                           '/documents/architectural-request-form'),
        ('Move-In/Out Request Form',         'forms',     '2024-01-01', '56 KB',   'Required for scheduling elevator and loading dock access.',                           '/documents/move-in-out-form'),
        ('CC&Rs – Declaration of Covenants', 'legal',     '2015-06-10', '3.4 MB',  'Original Declaration of Covenants, Conditions, and Restrictions.',                   '/documents/ccrs-declaration'),
        ('Reserve Study 2024–2034',          'financial', '2024-07-01', '1.8 MB',  '10-year reserve study and funding plan for major repairs.',                           '/documents/reserve-study-2024'),
        ('Pet Policy Addendum',              'rules',     '2023-05-15', '92 KB',   'Updated pet registration requirements and breed restrictions.',                       '/documents/pet-policy')
    `);
    console.log("Documents seeded (12 rows)");
  }

  app.get("/api/documents", async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, title, category, doc_date, file_size, description, doc_path FROM documents ORDER BY doc_date DESC"
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Documents fetch error:", err);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", async (req, res) => {
    try {
      const { title, category, doc_date, file_size, description, doc_path } = req.body;
      if (!title || !category || !doc_date) {
        return res.status(400).json({ error: "title, category, and doc_date are required" });
      }
      const result = await pool.query(
        `INSERT INTO documents (title, category, doc_date, file_size, description, doc_path)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [title, category, doc_date, file_size || null, description || null, doc_path || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Document create error:", err);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  app.put("/api/documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, category, doc_date, file_size, description, doc_path } = req.body;
      const result = await pool.query(
        `UPDATE documents SET title=$1, category=$2, doc_date=$3, file_size=$4, description=$5, doc_path=$6
         WHERE id=$7 RETURNING *`,
        [title, category, doc_date, file_size || null, description || null, doc_path || null, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Document not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Document update error:", err);
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM documents WHERE id=$1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Document delete error:", err);
      res.status(500).json({ error: "Failed to delete document" });
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

  app.get("/api/dues/stripe-configured", async (_req, res) => {
    res.json({ configured: await isStripeConfigured() });
  });

  app.get("/api/admin/stripe-status", async (_req, res) => {
    try {
      const configured = await isStripeConfigured();
      const pkResult = await pool.query(
        "SELECT value FROM hoa_settings WHERE key='stripe_publishable_key' LIMIT 1"
      );
      const publishableKey = pkResult.rows[0]?.value ?? null;
      const hasEnvKey = !!process.env.STRIPE_SECRET_KEY;
      const skResult = await pool.query(
        "SELECT value FROM hoa_settings WHERE key='stripe_secret_key' LIMIT 1"
      );
      const hasDbKey = !!skResult.rows[0]?.value;
      res.json({ configured, publishableKey, hasEnvKey, hasDbKey });
    } catch (err) {
      console.error("Stripe status error:", err);
      res.status(500).json({ error: "Failed to get Stripe status" });
    }
  });

  app.post("/api/admin/stripe-setup", async (req, res) => {
    try {
      const { secretKey, publishableKey } = req.body;
      if (!secretKey) return res.status(400).json({ error: "secretKey is required" });
      if (!secretKey.startsWith("sk_")) {
        return res.status(400).json({ error: "Invalid secret key. Must start with sk_test_ or sk_live_" });
      }

      const stripe = new (await import("stripe")).default(secretKey, { apiVersion: "2024-12-18.acacia" });
      try {
        await stripe.accounts.retrieve();
      } catch (err: any) {
        if (err?.type === "StripeAuthenticationError") {
          return res.status(400).json({ error: "Invalid Stripe secret key — authentication failed" });
        }
      }

      await pool.query(
        `INSERT INTO hoa_settings (key, value, updated_at)
         VALUES ('stripe_secret_key', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
        [secretKey]
      );

      if (publishableKey) {
        await pool.query(
          `INSERT INTO hoa_settings (key, value, updated_at)
           VALUES ('stripe_publishable_key', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
          [publishableKey]
        );
      }

      resetStripeSync();
      res.json({ success: true, live: secretKey.startsWith("sk_live_") });
    } catch (err) {
      console.error("Stripe setup error:", err);
      res.status(500).json({ error: "Failed to save Stripe configuration" });
    }
  });

  app.delete("/api/admin/stripe-setup", async (_req, res) => {
    try {
      await pool.query("DELETE FROM hoa_settings WHERE key IN ('stripe_secret_key','stripe_publishable_key')");
      resetStripeSync();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to remove Stripe configuration" });
    }
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

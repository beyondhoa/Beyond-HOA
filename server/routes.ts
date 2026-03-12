import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";
import { pool } from "./db";

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

  const httpServer = createServer(app);
  return httpServer;
}

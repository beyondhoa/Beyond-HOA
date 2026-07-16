// @ts-nocheck
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// GET /api/announcements
router.get("/announcements", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, content, category, pinned, created_at AS \"createdAt\" FROM announcements ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Announcements fetch database error");
    res.status(500).json({ error: "Failed to fetch announcements from database" });
  }
});

// POST /api/announcements
router.post("/announcements", async (req, res) => {
  try {
    const { title, content, category, pinned } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required fields" });
    }

    const result = await pool.query(
      "INSERT INTO announcements (title, content, category, pinned) VALUES ($1, $2, $3, $4) RETURNING id, title, content, category, pinned, created_at AS \"createdAt\"",
      [title, content, category || "general", pinned ?? false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    req.log.error({ err }, "Announcement creation database error");
    res.status(500).json({ error: "Failed to save announcement to database" });
  }
});

// DELETE /api/announcements/:id
router.delete("/announcements/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM announcements WHERE id = $1 RETURNING *", [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    res.json({ success: true, message: "Announcement cleared cleanly" });
  } catch (err) {
    req.log.error({ err }, "Announcement deletion database error");
    res.status(500).json({ error: "Failed to remove announcement from database" });
  }
});

export default router;

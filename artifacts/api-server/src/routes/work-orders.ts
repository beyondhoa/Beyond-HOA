// @ts-nocheck
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/work-orders", async (req, res) => {
  try {
    const { unit } = req.query;
    let query = "SELECT * FROM work_orders";
    const params: string[] = [];
    if (unit) { query += " WHERE unit=$1"; params.push(unit as string); }
    query += " ORDER BY created_at DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Work orders fetch error");
    res.status(500).json({ error: "Failed to fetch work orders" });
  }
});

router.post("/work-orders", async (req, res) => {
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
    req.log.error({ err }, "Work order create error");
    res.status(500).json({ error: "Failed to create work order" });
  }
});

router.put("/work-orders/:id", async (req, res) => {
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
    req.log.error({ err }, "Work order update error");
    res.status(500).json({ error: "Failed to update work order" });
  }
});

router.delete("/work-orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM work_orders WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Work order delete error");
    res.status(500).json({ error: "Failed to delete work order" });
  }
});

export default router;

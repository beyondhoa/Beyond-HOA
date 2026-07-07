// @ts-nocheck
import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { DEFAULT_PASSWORD } from "../lib/auth";

const router: IRouter = Router();

router.get("/residents", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM residents ORDER BY unit ASC");
    res.json(result.rows);
  } catch (err) {
    _req.log.error({ err }, "Residents fetch error");
    res.status(500).json({ error: "Failed to fetch residents" });
  }
});

router.post("/residents", async (req, res) => {
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
    req.log.error({ err }, "Resident create error");
    res.status(500).json({ error: "Failed to create resident" });
  }
});

router.put("/residents/:id", async (req, res) => {
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
    req.log.error({ err }, "Resident update error");
    res.status(500).json({ error: "Failed to update resident" });
  }
});

router.delete("/residents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM residents WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Resident delete error");
    res.status(500).json({ error: "Failed to delete resident" });
  }
});

export default router;

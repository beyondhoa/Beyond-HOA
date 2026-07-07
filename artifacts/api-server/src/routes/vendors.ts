// @ts-nocheck
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/vendors", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM vendors WHERE active=TRUE ORDER BY name ASC");
    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Vendors fetch error");
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
});

router.post("/vendors", async (req, res) => {
  try {
    const { name, specialty, phone, email } = req.body;
    if (!name || !specialty) return res.status(400).json({ error: "name and specialty required" });
    const result = await pool.query(
      "INSERT INTO vendors (name, specialty, phone, email) VALUES ($1,$2,$3,$4) RETURNING *",
      [name, specialty, phone || null, email || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    req.log.error({ err }, "Vendor create error");
    res.status(500).json({ error: "Failed to create vendor" });
  }
});

export default router;

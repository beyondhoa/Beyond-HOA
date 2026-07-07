// @ts-nocheck
import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";
import { requireAuth, JWT_SECRET, DEFAULT_PASSWORD } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
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
      { residentId: resident.id, email: resident.email },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    const { password_hash: _ph, ...safeResident } = resident;
    res.json({ token, resident: safeResident });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/auth/me", requireAuth, async (req, res) => {
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
    req.log.error({ err }, "Auth me error");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
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
    req.log.error({ err }, "Change password error");
    res.status(500).json({ error: "Failed to change password" });
  }
});

router.post("/residents/:id/reset-password", async (req, res) => {
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
    req.log.error({ err }, "Reset password error");
    res.status(500).json({ error: "Failed to reset password" });
  }
});

export default router;

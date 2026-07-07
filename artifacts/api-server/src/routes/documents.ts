// @ts-nocheck
import { Router, type IRouter } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// Both `dev` and `start` run the esbuild-bundled dist/index.mjs (see package.json),
// so import.meta.url always resolves to artifacts/api-server/dist — templates
// live one level up, at artifacts/api-server/templates.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../templates");

const DOCUMENT_TEMPLATES = new Set([
  "budget-2026",
  "minutes-q4-2025",
  "minutes-q3-2025",
  "bylaws-2024",
  "rules-regulations",
  "architectural-guidelines",
  "financial-report-2025",
  "ccrs-declaration",
  "reserve-study-2024",
  "pet-policy",
  "architectural-request-form",
  "move-in-out-form",
]);

router.get("/documents", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, category, doc_date, file_size, description, doc_path FROM documents ORDER BY doc_date DESC"
    );
    res.json(result.rows);
  } catch (err) {
    _req.log.error({ err }, "Documents fetch error");
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

router.post("/documents", async (req, res) => {
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
    req.log.error({ err }, "Document create error");
    res.status(500).json({ error: "Failed to create document" });
  }
});

router.put("/documents/:id", async (req, res) => {
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
    req.log.error({ err }, "Document update error");
    res.status(500).json({ error: "Failed to update document" });
  }
});

router.delete("/documents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM documents WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Document delete error");
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Serves the static HTML document templates (bylaws, minutes, forms, etc).
// NOTE: in the original monolith these lived at /documents/<slug>; here they are
// namespaced under /api/documents/view/<slug> since only /api is proxied to this service.
router.get("/documents/view/:slug", (req, res) => {
  const { slug } = req.params;
  if (!DOCUMENT_TEMPLATES.has(slug)) {
    return res.status(404).json({ error: "Document not found" });
  }
  const filePath = path.join(TEMPLATES_DIR, `${slug}.html`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.sendFile(filePath);
});

export default router;

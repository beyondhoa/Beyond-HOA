// @ts-nocheck
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const openai = {
  chat: {
    completions: {
      create: async () => ({
        choices: [{ message: { content: JSON.stringify({
          violation_type: "Other",
          description: "AI analysis placeholder log text.",
          required_action: "Review community guidelines.",
          severity: "low",
          fine_suggestion: 0,
          compliance_days: 14,
          summary: "Inspection Pending"
        }) }}]
      })
    }
  }
};

const router: IRouter = Router();

router.get("/violations", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM violations ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    _req.log.error({ err }, "Violations fetch error");
    res.status(500).json({ error: "Failed to fetch violations" });
  }
});

router.post("/violations", async (req, res) => {
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
    req.log.error({ err }, "Violation create error");
    res.status(500).json({ error: "Failed to create violation" });
  }
});

router.post("/violations/analyze-image", async (req, res) => {
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
    req.log.error({ err }, "Violation image analysis error");
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

router.put("/violations/:id/status", async (req, res) => {
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
    req.log.error({ err }, "Violation status error");
    res.status(500).json({ error: "Failed to update violation" });
  }
});

router.put("/violations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      resident_name, unit, violation_type, incident_date, 
      compliance_deadline, description, required_action, 
      fine_amount, notes, issued_by 
    } = req.body;

    const result = await pool.query(
      `UPDATE violations 
       SET resident_name=$1, unit=$2, violation_type=$3, incident_date=$4, 
           compliance_deadline=$5, description=$6, required_action=$7, 
           fine_amount=$8, notes=$9, issued_by=$10
       WHERE id=$11 RETURNING *`,
      [
        resident_name, unit, violation_type, incident_date, 
        compliance_deadline, description, required_action, 
        fine_amount ? parseFloat(fine_amount) : null, notes, issued_by, 
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Violation record not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    req.log.error({ err }, "Violation full update error");
    res.status(500).json({ error: "Failed to update full violation record" });
  }
});

router.delete("/violations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM violations WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Violation delete error");
    res.status(500).json({ error: "Failed to delete violation" });
  }
});

export default router;

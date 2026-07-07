// @ts-nocheck
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { DEFAULT_PASSWORD } from "./auth";

export async function runStartupMigrations(): Promise<void> {
  // ── Auth migration ──────────────────────────────────────────
  await pool.query(`
    ALTER TABLE residents ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
  `);
  const noPassword = await pool.query(
    "SELECT id FROM residents WHERE password_hash IS NULL"
  );
  if (noPassword.rowCount && noPassword.rowCount > 0) {
    const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    await pool.query(
      "UPDATE residents SET password_hash=$1 WHERE password_hash IS NULL",
      [defaultHash]
    );
    logger.info({ count: noPassword.rowCount }, "Set default password for residents without one");
  }

  // ── One-time resident reseed migration ──────────────────────
  {
    const flag = await pool.query(
      "SELECT value FROM hoa_settings WHERE key='residents_seed_v2' LIMIT 1"
    );
    if (flag.rowCount === 0) {
      const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      await pool.query("DELETE FROM residents");
      await pool.query("ALTER SEQUENCE residents_id_seq RESTART WITH 1");
      const seedResidents = [
        ["Sarah Mitchell", "101", "sarah.mitchell@email.com", "(555) 210-4821", "owner", "2019-03-15", "HOA Board President"],
        ["James Thornton", "102", "j.thornton@email.com", "(555) 341-7703", "owner", "2020-07-01", null],
        ["Maria Gonzalez", "103", "maria.g@email.com", "(555) 482-9210", "owner", "2022-01-10", "Leasing unit from Patel family"],
        ["David Okafor", "104", "d.okafor@email.com", "(555) 593-0044", "owner", "2018-11-20", "HOA Treasurer"],
        ["Priya Patel", "201", "priya.patel@email.com", "(555) 614-2299", "owner", "2021-04-05", null],
        ["Tom & Lisa Chen", "202", "chenfamily@email.com", "(555) 725-8811", "owner", "2017-08-12", "HOA Secretary"],
        ["Rachel Kim", "203", "rachel.kim@email.com", "(555) 836-4450", "owner", "2023-06-01", null],
        ["Marcus Webb", "204", "m.webb@email.com", "(555) 947-5533", "owner", "2016-02-28", "HOA Board Member"],
        ["Emily Sanders", "301", "e.sanders@email.com", "(555) 058-6677", "owner", "2022-09-14", null],
        ["Carlos Rivera", "302", "carlos.r@email.com", "(555) 169-7724", "owner", "2023-11-01", null],
        ["Natasha Brown", "303", "n.brown@email.com", "(555) 270-8891", "owner", "2020-12-07", null],
        ["Kevin Park", "304", "kevin.park@email.com", "(555) 381-9912", "owner", "2019-05-22", "Board Member at Large"],
      ];
      for (const [name, unit, email, phone, status, move_in_date, notes] of seedResidents) {
        await pool.query(
          `INSERT INTO residents (name, unit, email, phone, status, move_in_date, notes, password_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [name, unit, email, phone, status, move_in_date, notes, defaultHash]
        );
      }
      await pool.query(
        `INSERT INTO hoa_settings (key, value, updated_at) VALUES ('residents_seed_v2','done',NOW())`
      );
      logger.info("Resident reseed v2 applied: 12 owners inserted");
    }
  }

  // ── Documents seed (idempotent) ─────────────────────────────
  const { rowCount: docCount } = await pool.query("SELECT 1 FROM documents LIMIT 1");
  if ((docCount ?? 0) === 0) {
    await pool.query(`
      INSERT INTO documents (title, category, doc_date, file_size, description, doc_path) VALUES
        ('HOA Bylaws – 2024 Revision',       'bylaws',    '2024-01-15', '1.2 MB',  'Governing bylaws for Beyond HOA, revised January 2024.',                              '/api/documents/view/bylaws-2024'),
        ('Community Rules & Regulations',    'rules',     '2024-03-01', '856 KB',  'Complete rules covering landscaping, parking, noise, and pets.',                      '/api/documents/view/rules-regulations'),
        ('Architectural Review Guidelines',  'rules',     '2023-11-10', '432 KB',  'Standards and approval process for exterior modifications.',                          '/api/documents/view/architectural-guidelines'),
        ('Q4 2025 Board Meeting Minutes',    'minutes',   '2025-12-20', '124 KB',  'Official minutes from the December quarterly board meeting.',                         '/api/documents/view/minutes-q4-2025'),
        ('Q3 2025 Board Meeting Minutes',    'minutes',   '2025-09-18', '118 KB',  'Official minutes from the September quarterly board meeting.',                        '/api/documents/view/minutes-q3-2025'),
        ('Annual Financial Report 2025',     'financial', '2026-01-31', '2.1 MB',  'Year-end financial statements and budget overview for 2025.',                         '/api/documents/view/financial-report-2025'),
        ('2026 Operating Budget',            'financial', '2025-12-01', '445 KB',  'Approved operating and reserve budget for fiscal year 2026.',                         '/api/documents/view/budget-2026'),
        ('Architectural Request Form',       'forms',     '2024-01-01', '88 KB',   'Submit for any exterior changes requiring board approval.',                           '/api/documents/view/architectural-request-form'),
        ('Move-In/Out Request Form',         'forms',     '2024-01-01', '56 KB',   'Required for scheduling elevator and loading dock access.',                           '/api/documents/view/move-in-out-form'),
        ('CC&Rs – Declaration of Covenants', 'legal',     '2015-06-10', '3.4 MB',  'Original Declaration of Covenants, Conditions, and Restrictions.',                   '/api/documents/view/ccrs-declaration'),
        ('Reserve Study 2024–2034',          'financial', '2024-07-01', '1.8 MB',  '10-year reserve study and funding plan for major repairs.',                           '/api/documents/view/reserve-study-2024'),
        ('Pet Policy Addendum',              'rules',     '2023-05-15', '92 KB',   'Updated pet registration requirements and breed restrictions.',                       '/api/documents/view/pet-policy')
    `);
    logger.info("Documents seeded (12 rows)");
  }
}

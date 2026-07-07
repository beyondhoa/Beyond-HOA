import { pgTable, serial, varchar, integer, date, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const violationsTable = pgTable("violations", {
  id: serial("id").primaryKey(),
  residentName: varchar("resident_name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  violationType: varchar("violation_type", { length: 100 }).notNull(),
  noticeNumber: integer("notice_number").notNull().default(1),
  incidentDate: date("incident_date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  requiredAction: text("required_action").notNull(),
  complianceDeadline: date("compliance_deadline", { mode: "string" }).notNull(),
  fineAmount: numeric("fine_amount", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  notes: text("notes"),
  issuedBy: varchar("issued_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  photoUrl: text("photo_url"),
  assignedVendor: text("assigned_vendor"),
});

export const insertViolationSchema = createInsertSchema(violationsTable).omit({
  id: true,
  createdAt: true,
  status: true,
});
export type InsertViolation = z.infer<typeof insertViolationSchema>;
export type Violation = typeof violationsTable.$inferSelect;

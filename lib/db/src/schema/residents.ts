import { pgTable, serial, varchar, date, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const residentsTable = pgTable("residents", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  status: varchar("status", { length: 20 }).notNull().default("owner"),
  moveInDate: date("move_in_date", { mode: "string" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  passwordHash: varchar("password_hash", { length: 255 }),
});

export const insertResidentSchema = createInsertSchema(residentsTable).omit({
  id: true,
  createdAt: true,
  passwordHash: true,
});
export type InsertResident = z.infer<typeof insertResidentSchema>;
export type Resident = typeof residentsTable.$inferSelect;

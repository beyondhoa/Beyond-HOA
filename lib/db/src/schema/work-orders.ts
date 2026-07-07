import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workOrdersTable = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  residentName: varchar("resident_name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  priority: varchar("priority", { length: 20 }).notNull().default("medium"),
  description: text("description").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("submitted"),
  boardNotes: text("board_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWorkOrderSchema = createInsertSchema(workOrdersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  boardNotes: true,
});
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type WorkOrder = typeof workOrdersTable.$inferSelect;

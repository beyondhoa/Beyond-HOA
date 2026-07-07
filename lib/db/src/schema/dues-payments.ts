import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const duesPaymentsTable = pgTable("dues_payments", {
  id: serial("id").primaryKey(),
  duesId: text("dues_id").notNull(),
  period: text("period").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  stripeSessionId: text("stripe_session_id").unique("dues_payments_stripe_session_id_key"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDuesPaymentSchema = createInsertSchema(duesPaymentsTable).omit({
  id: true,
  createdAt: true,
  status: true,
  paidAt: true,
  stripePaymentIntentId: true,
});
export type InsertDuesPayment = z.infer<typeof insertDuesPaymentSchema>;
export type DuesPayment = typeof duesPaymentsTable.$inferSelect;

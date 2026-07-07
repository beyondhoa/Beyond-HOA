import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hoaSettingsTable = pgTable("hoa_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertHoaSettingSchema = createInsertSchema(hoaSettingsTable).omit({
  updatedAt: true,
});
export type InsertHoaSetting = z.infer<typeof insertHoaSettingSchema>;
export type HoaSetting = typeof hoaSettingsTable.$inferSelect;

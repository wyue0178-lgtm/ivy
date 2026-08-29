import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const printRequests = sqliteTable("print_requests", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  contact: text("contact").notNull(),
  desiredSize: text("desired_size").notNull(),
  notes: text("notes").notNull().default(""),
  imageKey: text("image_key").notNull(),
  imageName: text("image_name").notNull(),
  imageType: text("image_type").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

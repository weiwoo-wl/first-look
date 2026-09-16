import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const creations = sqliteTable("creations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("早期测试"),
  story: text("story").notNull().default(""),
  creatorId: text("creator_id").notNull(),
  creatorName: text("creator_name").notNull(),
  mediaKey: text("media_key"),
  mediaType: text("media_type"),
  visibility: text("visibility").notNull().default("published"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({ slugIndex: uniqueIndex("creations_slug_idx").on(table.slug) }));

export const creationLikes = sqliteTable("creation_likes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  creationId: integer("creation_id").notNull().references(() => creations.id),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const creationShares = sqliteTable("creation_shares", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  creationId: integer("creation_id").notNull().references(() => creations.id),
  source: text("source").notNull().default("copy-link"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

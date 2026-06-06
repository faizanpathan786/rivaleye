import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const creditTransactionTypeEnum = pgEnum("credit_transaction_type", ["purchase", "debit"]);

export const credit_packs = pgTable("credit_packs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  credits: integer("credits").notNull(),
  price_paise: integer("price_paise").notNull(),
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const user_credits = pgTable("user_credits", {
  user_id: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  free_scan_used: boolean("free_scan_used").notNull().default(false),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const credit_transactions = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: creditTransactionTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  pack_id: uuid("pack_id").references(() => credit_packs.id),
  razorpay_order_id: text("razorpay_order_id"),
  razorpay_payment_id: text("razorpay_payment_id"),
  description: text("description").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type CreditPack = typeof credit_packs.$inferSelect;
export type UserCredits = typeof user_credits.$inferSelect;
export type CreditTransaction = typeof credit_transactions.$inferSelect;

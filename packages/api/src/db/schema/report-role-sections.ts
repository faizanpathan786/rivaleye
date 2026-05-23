import { integer, jsonb, pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { reports } from "./reports";

export const report_section_type_enum = pgEnum("report_section_type", [
  "overview", "founder", "product", "marketing", "growth", "evidence",
]);
export type ReportSectionType = typeof report_section_type_enum.enumValues[number];

export const report_role_sections = pgTable(
  "report_role_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    section_type: report_section_type_enum("section_type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    schema_version: integer("schema_version").notNull().default(1),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("report_role_sections_report_section_uniq").on(t.report_id, t.section_type),
  ],
);

export type ReportRoleSection = typeof report_role_sections.$inferSelect;
export type NewReportRoleSection = typeof report_role_sections.$inferInsert;

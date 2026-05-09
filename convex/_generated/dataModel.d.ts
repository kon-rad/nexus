/* eslint-disable */
/**
 * Generated data model types.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 *
 * Note: hand-trimmed so it does not import `../schema.js`. The web app's
 * tsconfig cannot resolve convex source files (they import `convex/server`
 * which resolves only at Convex deploy time). Tables here are kept in sync
 * with `convex/schema.ts` manually; rerun `npx convex dev` once Convex CLI is
 * able to regenerate against the workspace.
 */

import type { GenericId } from "convex/values";

/**
 * The names of all of your Convex tables.
 */
export type TableNames =
  | "sessions"
  | "events"
  | "files"
  | "logs"
  | "sandbox";

export type SystemTableNames = "_scheduled_functions" | "_storage";

/**
 * The type of a document stored in Convex.
 *
 * @typeParam TableName - A string literal type of the table name.
 */
export type Doc<TableName extends TableNames> = {
  _id: Id<TableName>;
  _creationTime: number;
  [key: string]: unknown;
};

/**
 * An identifier for a document in Convex.
 *
 * @typeParam TableName - A string literal type of the table name.
 */
export type Id<TableName extends TableNames | SystemTableNames> =
  GenericId<TableName>;

/**
 * A type describing your Convex data model. Loosely typed at the model level;
 * specific tables and indexes are typed at the function-call site.
 */
export type DataModel = Record<TableNames, { document: Doc<TableNames> }>;

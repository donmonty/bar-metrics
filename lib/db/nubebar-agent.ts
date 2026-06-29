/**
 * `lib/db/nubebar-agent.ts` — the connection seam for the locked-down
 * `nubebar_agent` Postgres role (issue #49, PRD #48, ADR 0001 / ADR 0002).
 *
 * This is a categorically different security boundary from
 * `lib/db/nubebar` (the trusted, Prisma-backed seam): there is no Prisma
 * client for `nubebar_agent` (see `lib/db/nubebar/agent-rls.test.ts`), so
 * this module talks to it directly via raw `pg`. It is the main safety
 * surface for the upcoming SQL escape-hatch chat tool (#51) — every
 * guardrail below is a deliberate defense-in-depth layer, not boilerplate:
 *
 * 1. App-layer single-statement/SELECT-only validation, *before* any
 *    connection is opened — a second barrier on top of the role's own
 *    SELECT-only grants (already proven in `agent-rls.test.ts`), and one
 *    that fails fast without burning a DB round-trip.
 * 2. A fresh `pg.Client` per call, never pooled. `app.sucursal_ids` is a
 *    session-scoped Postgres setting; pooling would risk leaking one
 *    caller's tenant scope into another request's reused connection unless
 *    every checkout/checkin path reliably resets it. Opening fresh avoids
 *    that risk by construction (PRD #48, "Connection architecture").
 * 3. A 15s `statement_timeout`, set per-connection before the query runs,
 *    so a runaway or malformed query can't hang the chat indefinitely.
 * 4. `app.sucursal_ids` set via `set_config(...)` from the caller-supplied
 *    scope only — RLS policies on the `nubebar_agent` role (already applied
 *    via `scripts/nubebar-agent-rls.sql`, issue #32) enforce tenant
 *    isolation in the database itself, fail-closed when the setting is
 *    unset or empty (ADR 0002's amendment explains why this holds without
 *    `FORCE ROW LEVEL SECURITY`).
 * 5. A 100-row cap, enforced at the app layer independently of how the
 *    query itself is shaped.
 *
 * This module has no chatbot/tool-calling knowledge — it is a plain
 * function callers (the next slice's `runAnalyticalQuery` tool) build
 * their own user-facing messaging on top of.
 */
import { Client } from "pg";

const STATEMENT_TIMEOUT_MS = 15_000;
const ROW_CAP = 100;

/** Keywords that mark a write/DDL/procedural statement — categorically disallowed. */
const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "MERGE",
  "CALL",
  "EXECUTE",
  "COPY",
  "LISTEN",
  "NOTIFY",
  "VACUUM",
  "REINDEX",
  "DO",
];

/**
 * Function names whose presence anywhere in the query is rejected outright,
 * regardless of statement shape — a security review of this module (the
 * project's main safety surface, ADR 0001) found that a `SELECT` containing
 * a call to `set_config('app.sucursal_ids', ..., false)` (e.g. tucked inside
 * a CTE: `WITH _ AS (SELECT set_config(...)) SELECT * FROM ventas`) starts
 * with SELECT, contains no semicolon, and matches no write keyword above —
 * yet would override the trusted, caller-supplied Sucursal scope this module
 * sets *for the same session* before letting the query run, defeating RLS
 * tenant isolation from inside the "read-only" statement. Blocking the GUC
 * functions outright closes that path; `current_setting` is blocked too
 * since it could otherwise be used to read back and exfiltrate the scope.
 */
const FORBIDDEN_FUNCTIONS = ["set_config", "current_setting"];

export type QueryRejection = { error: "rejected"; message: string };
export type QueryDbError = { error: "db_error"; message: string };
export type QueryError = QueryRejection | QueryDbError;
export type QueryResult = { rows: Record<string, unknown>[] };

/**
 * Strips SQL comments (`-- ...` and `/* ... *&#47;`, including nested block
 * comments) and blanks out the contents of string literals (`'...'`),
 * quoted identifiers (`"..."`), and dollar-quoted strings (`$tag$...$tag$`)
 * from `sql`, leaving real code tokens untouched and in their original
 * positions. This is a quote/comment-aware scan (a small state machine, not
 * a second regex pass) deliberately — a security review found that a naive
 * regex-based comment strip is itself bypassable: stripping `/* ... *&#47;`
 * without tracking quote state would treat a `/*` that appears *inside* a
 * string literal as the start of a real comment, letting an attacker hide
 * actual code between a `/*` planted inside an earlier string and a later
 * `*&#47;`, which Postgres parses as plain string contents and ordinary
 * code (not a comment) — i.e. naive stripping reintroduces exactly the kind
 * of "detector sees nothing, database executes something else" gap this
 * function exists to close. Tracking real quote state avoids that: a `/*`
 * or `--` only starts a comment when it appears outside any string.
 *
 * Only this normalized copy is used for the keyword/semicolon/function
 * checks below — the original `sql` (comments and all) is still what's
 * sent to Postgres, since comments are harmless to actual execution.
 */
function stripCommentsAndLiterals(sql: string): string {
  let out = "";
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "-" && next === "-") {
      i += 2;
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < n) {
        if (sql[i] === quote && sql[i + 1] === quote) {
          i += 2; // escaped quote ('' or "") — still inside the literal
        } else if (sql[i] === quote) {
          i++;
          break;
        } else {
          i++;
        }
      }
      continue;
    }

    if (ch === "$") {
      const tagMatch = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
      if (tagMatch) {
        const tag = tagMatch[0];
        const end = sql.indexOf(tag, i + tag.length);
        if (end !== -1) {
          i = end + tag.length;
          continue;
        }
      }
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Validates that `sql` is exactly one `SELECT` statement: no semicolons (no
 * statement separators, so no stacking a second statement after one), and no
 * forbidden write/DDL/procedural keyword or GUC-manipulating function call
 * anywhere in the text. Every check runs against `stripCommentsAndLiterals`'s
 * output, not the raw string — see that function's docstring for why
 * (comments and string-literal contents are an evasion surface for naive
 * text scanning otherwise). Still deliberately keyword/regex-based rather
 * than a full SQL parser; a false positive (rejecting a legitimate query
 * whose string literal happens to contain a forbidden word — now harmless,
 * since literal contents are blanked before scanning) is an acceptable cost
 * for a fail-fast app-layer barrier that backs the role's own grants, not
 * the only line of defense.
 */
export function validateSelectOnly(sql: string): QueryRejection | null {
  const trimmed = sql.trim();

  if (trimmed.length === 0) {
    return { error: "rejected", message: "Query is empty." };
  }

  const scan = stripCommentsAndLiterals(trimmed);

  // Reject any semicolon, including one trailing the single statement —
  // simplest way to guarantee "exactly one statement" without a parser.
  if (scan.includes(";")) {
    return {
      error: "rejected",
      message: "Multiple statements (or a trailing semicolon) are not allowed.",
    };
  }

  if (!/^\s*select\b/i.test(scan)) {
    return {
      error: "rejected",
      message: "Only SELECT statements are allowed.",
    };
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(scan)) {
      return {
        error: "rejected",
        message: `Statement contains a disallowed keyword: ${keyword}.`,
      };
    }
  }

  for (const fn of FORBIDDEN_FUNCTIONS) {
    const pattern = new RegExp(`\\b${fn}\\s*\\(`, "i");
    if (pattern.test(scan)) {
      return {
        error: "rejected",
        message: `Statement contains a disallowed function call: ${fn}.`,
      };
    }
  }

  return null;
}

/**
 * Applies the 100-row cap to a validated SELECT by wrapping it as a
 * subquery with an outer `LIMIT`, e.g. `SELECT * FROM (<sql>) AS _capped
 * LIMIT 100`. Deliberately wraps rather than text-splicing the query's own
 * `LIMIT` clause: a security review of this module found that a single
 * regex match for the first `LIMIT n` in the text is bypassable by a
 * `UNION` (whose `LIMIT` only binds the first branch, leaving the second
 * branch's row count uncapped) and by a `LIMIT` inside a nested subquery
 * (which the regex would mistake for the query's own, leaving the real
 * outer result uncapped) — both let more than `cap` rows through despite
 * "having" a LIMIT in the text. Wrapping in an outer subquery always
 * governs the final row count handed back, regardless of any LIMIT/UNION
 * structure inside `sql`, independent of how many rows the inner query
 * would otherwise produce.
 */
export function applyRowCap(sql: string, cap: number = ROW_CAP): string {
  return `SELECT * FROM (${sql.trim()}) AS _capped LIMIT ${cap}`;
}

/**
 * Runs a single, caller-validated SELECT against `nubebar_agent`, scoped to
 * `sucursalIds`. Returns `{ rows }` on success or a structured `QueryError`
 * on any failure (guardrail rejection, DB error, or statement timeout) —
 * never throws, so callers don't need their own try/catch to build a
 * user-facing message.
 *
 * `sucursalIds` must be session-derived by the caller (mirroring the four
 * fixed tools' `sucursalId` closure pattern, ADR 0002) — this function
 * trusts whatever scope it's given and sets it verbatim via `set_config`;
 * an empty array sets an empty scope, which RLS treats as fail-closed
 * (zero rows), not unrestricted access.
 */
export async function runNubebarAgentQuery(
  sucursalIds: number[],
  sql: string,
): Promise<QueryResult | QueryError> {
  const rejection = validateSelectOnly(sql);
  if (rejection) return rejection;

  const connectionString = process.env.NUBEBAR_AGENT_DATABASE_URL;
  if (!connectionString) {
    return {
      error: "db_error",
      message: "NUBEBAR_AGENT_DATABASE_URL is not set.",
    };
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await client.query("SELECT set_config('app.sucursal_ids', $1, false)", [
      sucursalIds.join(","),
    ]);

    const cappedSql = applyRowCap(sql);
    const { rows } = await client.query(cappedSql);
    return { rows };
  } catch (err) {
    return {
      error: "db_error",
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await client.end();
  }
}

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAppDb } from "./index";

type AppDb = ReturnType<typeof getAppDb>;

/**
 * App DB migration round-trip integration test (issue #4): apply (assumed via
 * `prisma migrate deploy`) → write a row → read it back → assert equality.
 *
 * This needs a real Neon database, so it is SKIPPED when `DATABASE_URL` is
 * absent (e.g. CI / a fresh checkout before provisioning). Type-check and unit
 * tests still pass in that state. When the DB is wired, every row created here
 * is deleted in `afterAll` so the test leaves no residue.
 *
 * To run it: provision the Neon store (README → Environment), `vercel env pull`
 * (or set `DATABASE_URL` + `DATABASE_URL_UNPOOLED` in `.env.local`), apply the
 * migration with `npm run db:app:migrate:deploy`, then `npm test`.
 */
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("app DB migration round-trip", () => {
  // Resolved in beforeAll, not at collection time: getAppDb() throws without a
  // connection, and describe.skip still evaluates this callback body.
  let db: AppDb;
  const createdIds: string[] = [];

  beforeAll(() => {
    db = getAppDb();
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await db.healthCheck.deleteMany({ where: { id: { in: createdIds } } });
    }
    await db.$disconnect();
  });

  it("writes a row and reads it back unchanged", async () => {
    const note = `round-trip-${Date.now()}`;

    const created = await db.healthCheck.create({ data: { note } });
    createdIds.push(created.id);

    const readBack = await db.healthCheck.findUnique({
      where: { id: created.id },
    });

    expect(readBack).not.toBeNull();
    expect(readBack?.id).toBe(created.id);
    expect(readBack?.note).toBe(note);
  });
});

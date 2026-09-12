/**
 * Reading a Postgres error the way the driver in production throws it.
 *
 * This exists because of a bug that every test agreed did not exist.
 *
 * The plpgsql functions raise with deliberate SQLSTATEs, and the routes matched
 * on message text instead. The integration suite runs on PGlite, which puts the
 * raise text in error.message, so the matching worked and dozens of tests
 * passed. Production runs on neon-http, which throws a NeonDbError whose message
 * is not that text and whose SQLSTATE sits on a `code` field. Every raise fell
 * through to the unmapped branch, so a creator submitting somebody else's post
 * was told "something went wrong at our end", and so was anybody registering
 * with an email already in use. Both were live.
 *
 * So these tests model the SHAPE the real driver throws, which is the one thing
 * the integration suite structurally cannot reach.
 */

import { describe, expect, it } from "vitest";
import {
  isPgError,
  PG,
  pgErrorCode,
  pgErrorMessage,
} from "@/lib/db/errors";

/** What @neondatabase/serverless actually throws: an Error with a code field. */
function neonError(code: string, message = "db error"): Error {
  const e = new Error(message) as Error & { code: string; name: string };
  e.name = "NeonDbError";
  e.code = code;
  return e;
}

/** What PGlite throws: the raise text in the message, often with no code. */
function pgliteError(raiseName: string): Error {
  return new Error(raiseName);
}

describe("the shape production actually throws", () => {
  it("finds the code on a NeonDbError", () => {
    expect(pgErrorCode(neonError(PG.WRONG_ACCOUNT))).toBe("P0209");
  });

  it("recognises wrong_account from the code alone, with no matching text", () => {
    // The exact failure: the message says nothing useful and the mapping has to
    // work anyway.
    const error = neonError(PG.WRONG_ACCOUNT, "Error connecting to database");
    expect(isPgError(error, PG.WRONG_ACCOUNT, "wrong_account")).toBe(true);
  });

  it.each([
    [PG.EMAIL_TAKEN, "email_taken"],
    [PG.PHONE_TAKEN, "phone_taken"],
    [PG.PLATFORM_NOT_REGISTERED, "platform_not_registered"],
    [PG.ALREADY_SUBMITTED_FOR_PLATFORM, "already_submitted_for_platform"],
    [PG.URL_ALREADY_SUBMITTED, "url_already_submitted"],
    [PG.CHALLENGE_NOT_OPEN, "challenge_not_open"],
    [PG.CHALLENGE_ENDED, "challenge_ended"],
  ])("maps %s with an unhelpful message", (code, name) => {
    expect(isPgError(neonError(code, "db error"), code, name)).toBe(true);
  });

  it("does not confuse one raise for another", () => {
    const error = neonError(PG.WRONG_ACCOUNT);
    expect(isPgError(error, PG.PLATFORM_NOT_REGISTERED, "platform_not_registered")).toBe(
      false,
    );
  });
});

describe("wrapped errors", () => {
  it("finds a code on cause, since an ORM may wrap the driver error", () => {
    const wrapped = new Error("query failed") as Error & { cause: unknown };
    wrapped.cause = neonError(PG.URL_ALREADY_SUBMITTED);
    expect(pgErrorCode(wrapped)).toBe("P0208");
  });

  it("finds a code on sourceError, which NeonDbError carries", () => {
    const outer = new Error("outer") as Error & { sourceError: unknown };
    outer.sourceError = neonError(PG.EMAIL_TAKEN);
    expect(pgErrorCode(outer)).toBe("P0101");
  });

  it("gives up rather than looping on a circular error", () => {
    const a = new Error("a") as Error & { cause?: unknown };
    const b = new Error("b") as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;
    expect(() => pgErrorCode(a)).not.toThrow();
    expect(pgErrorCode(a)).toBeNull();
  });
});

describe("things that are not a SQLSTATE", () => {
  it.each([
    ["ECONNRESET"],
    ["ENOTFOUND"],
    ["ERR_INVALID_URL"],
    ["42"],
    [""],
  ])("ignores a code field of %o", (code) => {
    // A SQLSTATE is five characters. Without that guard a network error's code
    // would be read as one and mapped to nothing, or worse, to something.
    const e = new Error("network") as Error & { code: string };
    e.code = code;
    expect(pgErrorCode(e)).toBeNull();
  });

  it.each([[null], [undefined], ["a string"], [42]])(
    "returns null for %o rather than throwing",
    (value) => {
      expect(() => pgErrorCode(value)).not.toThrow();
      expect(pgErrorCode(value)).toBeNull();
    },
  );
});

describe("the PGlite fallback", () => {
  it("still matches the raise text when there is no code", () => {
    // The integration suite depends on this, and it is the only reason the
    // message check is kept at all.
    expect(
      isPgError(pgliteError("wrong_account"), PG.WRONG_ACCOUNT, "wrong_account"),
    ).toBe(true);
  });

  it("does not match a different raise", () => {
    expect(
      isPgError(pgliteError("challenge_ended"), PG.WRONG_ACCOUNT, "wrong_account"),
    ).toBe(false);
  });

  it("does not match when no raise name is given", () => {
    expect(isPgError(pgliteError("wrong_account"), PG.WRONG_ACCOUNT)).toBe(false);
  });
});

describe("messages, for logs", () => {
  it("reads an Error", () => {
    expect(pgErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("survives something that is not an Error", () => {
    expect(pgErrorMessage({ weird: true })).toContain("object");
  });
});

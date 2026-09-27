/**
 * The key every per-domain vote rule is judged under.
 *
 * The engine re-checks the key it is handed and falls back to the host, so a
 * wrong answer here fails safe. It does not fail loud, though: a key that
 * came back as the full host would quietly restore the subdomain lane (each
 * of a., b. and c.oemails.com with its own ten), and a key that came back as
 * a public suffix would pool every university in the country. Both are
 * silent in production, which is what earns these cases a test.
 */

import { describe, expect, it } from "vitest";
import { registrableDomain, voteDomainKey } from "@/lib/vote-domain";

describe("voteDomainKey", () => {
  it("folds subdomains onto the domain a person has to buy", () => {
    expect(voteDomainKey("hkltkjtzfm@oemails.com")).toBe("oemails.com");
    expect(voteDomainKey("x@a.oemails.com")).toBe("oemails.com");
    expect(voteDomainKey("x@a.b.c.oemails.com")).toBe("oemails.com");
  });

  it("knows the country suffixes, so a campus keys on the campus", () => {
    expect(voteDomainKey("x@live.unilag.edu.ng")).toBe("unilag.edu.ng");
    expect(voteDomainKey("x@stu.cu.edu.ng")).toBe("cu.edu.ng");
    expect(voteDomainKey("x@st.lasu.edu.ng")).toBe("lasu.edu.ng");
    expect(voteDomainKey("x@mail.example.co.uk")).toBe("example.co.uk");
  });

  it("ignores private suffixes, so free dynamic DNS names share one key", () => {
    // Under the private section of the list, 0-mailer.dynv6.net would be a
    // registrable domain of its own and every free name a fresh allowance.
    expect(voteDomainKey("x@x.0-mailer.dynv6.net")).toBe("dynv6.net");
    expect(voteDomainKey("x@0-mailer.dynv6.net")).toBe("dynv6.net");
  });

  it("falls back to the host when there is no registrable domain", () => {
    expect(voteDomainKey("x@edu.ng")).toBe("edu.ng");
    expect(voteDomainKey("x@com.ng")).toBe("com.ng");
  });

  it("takes a bare host as readily as an address", () => {
    // The console's cluster query hands over hosts, the verify route
    // addresses; both must land on the same key.
    expect(voteDomainKey("a.oemails.com")).toBe("oemails.com");
    expect(voteDomainKey("oemails.com")).toBe("oemails.com");
  });

  it("leaves the consumer providers as they are", () => {
    expect(voteDomainKey("ada@gmail.com")).toBe("gmail.com");
    expect(voteDomainKey("ada@yahoo.co.uk")).toBe("yahoo.co.uk");
  });

  it("folds case, so a raw address cannot key differently from its canonical form", () => {
    expect(voteDomainKey("X@A.OEMAILS.COM")).toBe("oemails.com");
  });
});

describe("registrableDomain", () => {
  it("answers null for a public suffix, which no domain-wide action may take", () => {
    expect(registrableDomain("edu.ng")).toBeNull();
    expect(registrableDomain("com.ng")).toBeNull();
    expect(registrableDomain("gov.ng")).toBeNull();
    expect(registrableDomain("co.uk")).toBeNull();
  });

  it("answers null for an IP address", () => {
    expect(registrableDomain("192.0.2.1")).toBeNull();
  });

  it("answers the domain for a domain or anything under it", () => {
    expect(registrableDomain("x.oemails.com")).toBe("oemails.com");
    expect(registrableDomain("unilag.edu.ng")).toBe("unilag.edu.ng");
  });
});

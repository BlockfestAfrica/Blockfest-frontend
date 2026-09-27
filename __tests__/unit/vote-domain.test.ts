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
import { NEVER_BLOCK_DOMAINS } from "@/lib/campaign-vote";
import { DISPOSABLE_DOMAINS, DISPOSABLE_DOMAINS_COMMIT } from "@/lib/data/disposable-domains";
import {
  BLOCKED_DOMAIN_ANSWER,
  DISPOSABLE_EXCEPTIONS,
  RELAY_DOMAINS,
  UNUSABLE_EMAIL,
  isRefusedHost,
  normaliseBlockDomain,
  registrableDomain,
  voteDomainKey,
} from "@/lib/vote-domain";
import { autoEvidenceSentence, isProtectedDomain } from "@/lib/vote-domain-copy";

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

describe("the domains a cast is refused from", () => {
  /*
   * A refusal here turns a person away before any code is sent, so both
   * directions matter: a disposable inbox that slips through is a free vote
   * per address, and a real provider caught by it is a real voter told to
   * go elsewhere.
   */
  const list = DISPOSABLE_DOMAINS.split("\n");

  it("refuses a disposable service and anything under it", () => {
    expect(isRefusedHost("mailinator.com")).toBe(true);
    expect(isRefusedHost("x.mailinator.com")).toBe(true);
    expect(isRefusedHost("MAILINATOR.COM.")).toBe(true);
  });

  it("refuses under a listed subdomain without refusing its parent", () => {
    // 0-mailer.dynv6.net is listed; dynv6.net is a free DNS service many
    // unrelated people use, and is not.
    expect(isRefusedHost("0-mailer.dynv6.net")).toBe(true);
    expect(isRefusedHost("x.0-mailer.dynv6.net")).toBe(true);
    expect(isRefusedHost("dynv6.net")).toBe(false);
    expect(isRefusedHost("y.dynv6.net")).toBe(false);
  });

  it("refuses the alias relays, which the public list leaves out", () => {
    for (const relay of RELAY_DOMAINS) {
      expect(list, relay).not.toContain(relay);
      expect(isRefusedHost(relay), relay).toBe(true);
    }
    expect(isRefusedHost("duck.com")).toBe(true);
  });

  it("never refuses a provider no block may touch", () => {
    for (const domain of NEVER_BLOCK_DOMAINS) {
      expect(list, domain).not.toContain(domain);
      expect(RELAY_DOMAINS, domain).not.toContain(domain);
      expect(isRefusedHost(domain), domain).toBe(false);
    }
  });

  it("leaves the incident's domain and ordinary domains alone", () => {
    // oemails.com was a farm, but not a disposable service; the block and
    // the cap deal with it, not this list.
    expect(isRefusedHost("oemails.com")).toBe(false);
    expect(isRefusedHost("unilag.edu.ng")).toBe(false);
    expect(isRefusedHost("paystack.com")).toBe(false);
  });

  it("carries the typo domains and the real-but-listed ones the plan checked", () => {
    for (const domain of ["gmial.com", "hotmial.com", "99.com", "co.cc"]) {
      expect(isRefusedHost(domain), domain).toBe(true);
    }
  });

  it("is the pinned upstream commit, with no public suffix on it", () => {
    expect(DISPOSABLE_DOMAINS_COMMIT).toMatch(/^[0-9a-f]{40}$/);
    expect(list.length).toBeGreaterThan(9000);
    expect(new Set(list).size).toBe(list.length);
    for (const entry of list) {
      if (registrableDomain(entry) === null) throw new Error(`${entry} is a public suffix`);
    }
    // The undo is empty until somebody needs it.
    expect(DISPOSABLE_EXCEPTIONS).toEqual([]);
  });
});

describe("the answer a refused cast gets", () => {
  it("is pinned, says what will work, and names no block", () => {
    expect(UNUSABLE_EMAIL).toBe(
      "We can't send a code to that address. Please use a personal email such as Gmail, Yahoo, Outlook or iCloud.",
    );
    expect(UNUSABLE_EMAIL).not.toMatch(/block|fraud|review|banned/i);
  });

  it("refuses blocked domains, as the owner asked", () => {
    expect(BLOCKED_DOMAIN_ANSWER).toBe("refuse");
  });
});

describe("normaliseBlockDomain", () => {
  it("lands a block on the registrable domain", () => {
    expect(normaliseBlockDomain("x.oemails.com")).toBe("oemails.com");
    expect(normaliseBlockDomain("OEMAILS.COM.")).toBe("oemails.com");
    expect(normaliseBlockDomain("someone@a.b.oemails.com")).toBe("oemails.com");
    expect(normaliseBlockDomain("live.unilag.edu.ng")).toBe("unilag.edu.ng");
  });

  it("answers null for a public suffix, an address or nothing", () => {
    expect(normaliseBlockDomain("edu.ng")).toBeNull();
    expect(normaliseBlockDomain("com.ng")).toBeNull();
    expect(normaliseBlockDomain("192.0.2.1")).toBeNull();
    expect(normaliseBlockDomain("")).toBeNull();
  });
});

describe("the console's words about blocks", () => {
  it("knows a school or government domain", () => {
    for (const d of ["unilag.edu.ng", "uniben.edu", "nysc.gov.ng", "ox.ac.uk", "abc.sch.ng", "army.mil"]) {
      expect(isProtectedDomain(d), d).toBe(true);
    }
    for (const d of ["oemails.com", "education.ng", "edu.com", "gov.farm.test"]) {
      expect(isProtectedDomain(d), d).toBe(false);
    }
  });

  it("turns an automatic block's evidence into a sentence with no address in it", () => {
    expect(
      autoEvidenceSentence({ kind: "forwarder", primary_mx: "route1.mx.cloudflare.net", verified: 3 }),
    ).toBe("Forwarding service (route1.mx.cloudflare.net), 3 verified votes this round");
    expect(autoEvidenceSentence({ kind: "other", verified: 4, machine_made: 3 })).toBe(
      "3 of 4 verified addresses look machine-made",
    );
    expect(autoEvidenceSentence(null)).toBeNull();
    expect(autoEvidenceSentence({ kind: "other" })).toBeNull();
  });
});

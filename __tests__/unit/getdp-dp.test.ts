/**
 * The Get DP picture's rules (app/getdp/lib/dp.ts), checked without a
 * canvas: what each role says, how a name breaks, who is in the footer and
 * where, what the days and the share text say, the file name, and the crop.
 */
import { describe, expect, it } from "vitest";
import {
  ART,
  DP_SIZE,
  FOOTER,
  NAME_MAX,
  NAME_MAX_W,
  chooseNameLayout,
  clampTransform,
  cropCentre,
  defaultTransform,
  dpFileName,
  drawableName,
  footerTiers,
  insideCircleCrop,
  layoutArt,
  layoutFooter,
  nameProblem,
  nudgeTransform,
  photoRect,
  publicDayLines,
  publicDaysRange,
  roleCopy,
  shareText,
  sizedSvg,
  DP_ROLES,
  type Box,
  type FooterTiers,
} from "@/app/getdp/lib/dp";
import { blockfest2026Lagos } from "@/lib/events";
import { headline, partners, sponsors, type Sponsor } from "@/lib/partners-2026";

/** A stand-in ruler: every letter 50 units wide at 100px, a space 25. */
const ruler = (line: string) => [...line].reduce((w, ch) => w + (ch === " " ? 25 : 50), 0);
/** Label widths, roughly Gotham's: 0.75em a letter plus tracking. */
const measureLabel = (text: string, size: number) => text.length * (size * 0.75 + 3.6);

/* The government, ecosystem and media partners are sponsors now (9 October),
   told apart by tier. The picture draws them as it did before the move. */
const tierNames = (...names: string[]) =>
  sponsors.filter((s) => names.includes(s.tier)).map((s) => s.name);
const onDp = (list: readonly { name: string; onDp?: boolean }[]) =>
  list.filter((p) => p.onDp !== false).map((p) => p.name);
const tieredSponsors = sponsors.filter((s) => !["Government", "Ecosystem", "Media"].includes(s.tier));

const tiers = footerTiers({ headline, sponsors, partners });
const footer = layoutFooter(tiers, measureLabel);

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("the name", () => {
  it("keeps a short name on one line at full size", () => {
    expect(chooseNameLayout("Adaeze Nwosu", ruler)).toEqual({ lines: ["ADAEZE NWOSU"], size: 196 });
  });

  it("breaks a long name into the most even pair of lines", () => {
    expect(chooseNameLayout("Chimamanda Ngozi Adichie-Okonkwo", ruler).lines).toEqual([
      "CHIMAMANDA NGOZI",
      "ADICHIE-OKONKWO",
    ]);
    // Both breaks reach the size cap and the lopsided one ("NGOZI /
    // ADAEZE OGOCHUKWUOMA") is found first; the even one still wins.
    const tied = chooseNameLayout("Ngozi Adaeze Ogochukwuoma", ruler);
    expect(tied.lines).toEqual(["NGOZI ADAEZE", "OGOCHUKWUOMA"]);
    expect(tied.size).toBe(156);
    expect(chooseNameLayout("Oluwaseun Adebayo-Johnson", ruler).lines).toEqual([
      "OLUWASEUN",
      "ADEBAYO-JOHNSON",
    ]);
  });

  it("compares one line with two at the size the height really allows", () => {
    // 31 letters: one line fits the width at 102. Two lines would fit the
    // width at the 156 cap, but the picture has room for two lines only at
    // about 104, which is not clearly larger, so one line wins.
    const name = "Oluwaseyifunmi Adebayo-Ogunsola";
    expect(chooseNameLayout(name, ruler).lines).toHaveLength(2);
    const capped = chooseNameLayout(name, ruler, NAME_MAX_W, (lines) =>
      lines.length > 1 ? 104 : 244,
    );
    expect(capped).toEqual({ lines: ["OLUWASEYIFUNMI ADEBAYO-OGUNSOLA"], size: 102 });
    // A name too long for one line at any decent size still breaks, at the
    // height's size, never at the width's.
    const long = chooseNameLayout(
      "Oluwatobiloba Adebayo-Ogunsola Chukwuemeka",
      ruler,
      NAME_MAX_W,
      (lines) => (lines.length > 1 ? 104 : 244),
    );
    expect(long.lines).toHaveLength(2);
    expect(long.size).toBe(104);
  });

  it("never sets a line wider than the room the circle crop leaves", () => {
    for (const name of [
      "Jo",
      "Oluwaseun Adebayo-Johnson Chukwuemeka Babatunde",
      "Abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwx",
      "WWWWWWWWWW WWWWWWWWWW WWWWWWWWWW WWWWWWWWWW WWWWWWW",
    ]) {
      const { lines, size } = chooseNameLayout(name, ruler);
      for (const line of lines) expect((ruler(line) * size) / 100).toBeLessThanOrEqual(NAME_MAX_W);
      expect(lines.join(lines.length > 1 ? " " : "").replace(/- /, "-")).toBe(
        name.toUpperCase(),
      );
    }
  });

  it("explains every name it cannot take", () => {
    expect(nameProblem("")).toMatch(/Enter your name/);
    expect(nameProblem("   ")).toMatch(/Enter your name/);
    expect(nameProblem("A")).toMatch(/at least 2 letters/);
    // The same words however far over, so an alert is not re-read at every key.
    expect(nameProblem("A".repeat(NAME_MAX + 1))).toBe("Keep it to 50 letters or fewer.");
    expect(nameProblem("A".repeat(NAME_MAX + 9))).toBe("Keep it to 50 letters or fewer.");
    expect(nameProblem("Ada 🎉")).toMatch(/cannot draw 🎉/);
    expect(nameProblem("李小龙")).toMatch(/cannot draw/);
    expect(nameProblem("--")).toMatch(/at least one letter/);
  });

  it("takes Yoruba, Igbo and Hausa names as they are written, counting letters not accents", () => {
    expect(nameProblem("Ọláolúwa Adéṣínà-Èkọ́")).toBeNull();
    expect(nameProblem("Chukwuemeka Ụzọ")).toBeNull();
    expect(nameProblem("Ɗanjuma Ƙabiru")).toBeNull();
    expect(nameProblem("D'Angelo O’Neil")).toBeNull();
    // Fifty letters, every one carrying a mark: still fifty.
    expect(nameProblem("Ọ́".repeat(NAME_MAX))).toBeNull();
  });

  it("previews only what the lettering can draw while a name is being typed", () => {
    expect(drawableName("  Ada   🎉 Obi ")).toBe("Ada Obi");
    expect(drawableName("🎉")).toBe("");
    expect([...drawableName("Ọ́".repeat(60)).normalize("NFD").replace(/\p{M}/gu, "")]).toHaveLength(NAME_MAX);
  });
});

describe("the four roles", () => {
  it("say the owner's words in the mark's colours", () => {
    expect(DP_ROLES).toEqual(["attendee", "speaker", "volunteer", "partner"]);
    expect(roleCopy("attendee")).toMatchObject({ line: "I’M ATTENDING", fill: "#1B64E4", text: "#FFFFFF" });
    expect(roleCopy("speaker")).toMatchObject({ line: "I’M SPEAKING", fill: "#F12D5B", text: "#FFFFFF" });
    expect(roleCopy("volunteer")).toMatchObject({ line: "I’M VOLUNTEERING", fill: "#1BBE9F", text: "#0A1628" });
    expect(roleCopy("partner")).toMatchObject({ line: "PROUD PARTNER", fill: "#F0C224", text: "#0A1628" });
  });
});

describe("the public days", () => {
  const text = publicDayLines()
    .map((d) => `${d.when} ${d.where}`)
    .join(" | ");

  it("are the 22nd at Ibis Hotel, Lekki and the 23rd at the National Art Theatre, short enough for one line", () => {
    // The owner, 9 October: both days on a single line, shortened.
    expect(publicDayLines()).toEqual([
      { when: "22 OCT", where: "IBIS HOTEL, LEKKI" },
      { when: "23 OCT", where: "NATIONAL ART THEATRE" },
    ]);
    expect(publicDaysRange()).toBe("22–23 October");
  });

  it("never show the private mixer on the 24th", () => {
    expect(text).not.toMatch(/\b24\b/);
    expect(blockfest2026Lagos.publicDays?.map((d) => d.date)).not.toContain("2026-10-24");
    // The site's own three-day span is left as it was, on purpose.
    expect(blockfest2026Lagos.date.end).toBe("2026-10-24T22:00:00+01:00");
  });

  it("reads a range across a month end", () => {
    expect(
      publicDaysRange([
        { date: "2026-10-31", venue: "A", area: "B", short: "A" },
        { date: "2026-11-01", venue: "C", area: "D", short: "C" },
      ]),
    ).toBe("31 October – 1 November");
  });
});

describe("sharing", () => {
  it("says the role, the public days, the link and #Blockfest2026", () => {
    expect(shareText("attendee")).toBe(
      "I'm attending Blockfest Africa 2026 in Lagos, 22–23 October. Get your DP: https://blockfestafrica.com/getdp #Blockfest2026",
    );
    for (const role of DP_ROLES) {
      const text = shareText(role);
      expect(text).toContain("#Blockfest2026");
      expect(text).toContain("https://blockfestafrica.com/getdp");
      expect(text).not.toMatch(/2025/);
      expect(text).not.toMatch(/\b24\b/);
    }
    expect(shareText("speaker")).toMatch(/^I'm speaking at /);
    expect(shareText("volunteer")).toMatch(/^I'm volunteering at /);
    expect(shareText("partner")).toMatch(/^Proud partner of /);
  });

  it("names the file after the person in plain letters", () => {
    expect(dpFileName("Ada Obi")).toBe("blockfest-2026-dp-ada-obi.png");
    expect(dpFileName("Ọláolúwa Adéṣínà-Èkọ́")).toBe("blockfest-2026-dp-olaoluwa-adesina-eko.png");
    expect(dpFileName("Ɗanjuma Ƙabiru Ŋozi")).toBe("blockfest-2026-dp-danjuma-kabiru-nozi.png");
    expect(dpFileName("Ɖossou Kǝlla Ɣevu")).toBe("blockfest-2026-dp-dossou-kella-gevu.png");
    expect(dpFileName("🎉")).toBe("blockfest-2026-dp.png");
    const long = dpFileName("Oluwaseun Adebayo-Johnson Chukwuemeka Babatunde");
    expect(long).toBe("blockfest-2026-dp-oluwaseun-adebayo-johnson-chukwuemeka.png");
    expect(long.length).toBeLessThanOrEqual("blockfest-2026-dp-.png".length + 40);
  });

  it("names a phone's share-list copy the same way, as a JPEG", () => {
    expect(dpFileName("Ada Obi", "jpg")).toBe("blockfest-2026-dp-ada-obi.jpg");
    expect(dpFileName("🎉", "jpg")).toBe("blockfest-2026-dp.jpg");
    expect(dpFileName("Ada Obi", "png")).toBe(dpFileName("Ada Obi"));
  });
});

describe("the photo crop", () => {
  it("centres a 9:16 selfie 39% of the way down, so the whole head is in", () => {
    const c = cropCentre(900, 1600, defaultTransform(900, 1600));
    expect(c.x).toBeCloseTo(0.5, 5);
    expect(c.y).toBeCloseTo(0.39, 5);
  });

  it("leaves a square or landscape photo centred: it has no height to spare", () => {
    expect(cropCentre(1200, 1200, defaultTransform(1200, 1200))).toEqual({ x: 0.5, y: 0.5 });
    const wide = cropCentre(1600, 900, defaultTransform(1600, 900));
    expect(wide.x).toBeCloseTo(0.5, 5);
    expect(wide.y).toBeCloseTo(0.5, 5);
  });

  it("keeps the frame covered however far the photo is pushed", () => {
    const frame = 800;
    for (const [iw, ih] of [[900, 1600], [1600, 900], [1200, 1200], [300, 2000]]) {
      for (const zoom of [0.2, 1, 1.7, 3, 9]) {
        for (const off of [-5, -0.4, 0, 0.3, 5]) {
          const t = clampTransform({ zoom, offsetX: off, offsetY: -off }, iw, ih);
          expect(t.zoom).toBeGreaterThanOrEqual(1);
          expect(t.zoom).toBeLessThanOrEqual(3);
          const r = photoRect(iw, ih, frame, t);
          expect(r.x).toBeLessThanOrEqual(1e-9);
          expect(r.y).toBeLessThanOrEqual(1e-9);
          expect(r.x + r.w).toBeGreaterThanOrEqual(frame - 1e-9);
          expect(r.y + r.h).toBeGreaterThanOrEqual(frame - 1e-9);
        }
      }
    }
  });

  it("moves by a fraction of the frame and stops at the photo's edge", () => {
    const start = { zoom: 2, offsetX: 0, offsetY: 0 };
    expect(nudgeTransform(start, 0.02, 0, 1200, 1200).offsetX).toBeCloseTo(0.02, 10);
    // At zoom 2 a square photo can move half a frame each way, no further.
    expect(nudgeTransform(start, 9, -9, 1200, 1200)).toEqual({ zoom: 2, offsetX: 0.5, offsetY: -0.5 });
    // At zoom 1 a square photo exactly fills the frame: nowhere to go.
    expect(nudgeTransform({ zoom: 1, offsetX: 0, offsetY: 0 }, 0.1, 0.1, 1200, 1200)).toEqual({
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

describe("the footer, from lib/partners-2026", () => {
  it("puts the headline sponsor first and dead centre", () => {
    expect(tiers.headline?.name).toBe("Monica");
    const [lead] = footer.sponsors;
    expect(lead.logo.name).toBe("Monica");
    expect(lead.x + lead.w / 2).toBeCloseTo(DP_SIZE / 2, 6);
    expect(footer.headlineLabel?.text).toBe("HEADLINE SPONSOR");
  });

  it("draws every sponsor, in the listed order, then the ecosystem partners in the same row", () => {
    const ecosystem = tierNames("Ecosystem");
    expect(ecosystem).toEqual(["Hashed Emergent", "Microtraction"]);
    const named = tieredSponsors.map((s) => s.name);
    expect(tiers.sponsors.map((s) => s.name)).toEqual([...named, ...ecosystem]);
    expect(footer.sponsors.map((s) => s.logo.name).sort()).toEqual(
      ["Monica", ...named, ...ecosystem].sort(),
    );
  });

  it("sets Hashed Emergent in the sponsors' row, after the sponsors, with no label of its own", () => {
    // The owner, 9 October: Hashed Emergent sits with the sponsors, unlabelled.
    // (It used to sit beside Hoaq; the four community sponsors added since now
    // stand between the two.)
    const row = footer.sponsors.slice(1).sort((a, b) => a.x - b.x).map((s) => s.logo.name);
    expect(row).toContain("Hashed Emergent");
    expect(row).toContain("Microtraction");
    const hashed = footer.sponsors.find((s) => s.logo.name === "Hashed Emergent")!;
    const hoaq = footer.sponsors.find((s) => s.logo.name === "Hoaq")!;
    expect(hashed.y + hashed.h / 2).toBeCloseTo(hoaq.y + hoaq.h / 2, 6);
    expect(footer.labels.map((l) => l.text)).not.toContain("ECOSYSTEM PARTNER");
  });

  it("sets the endorsement under the first sponsor on the left and spreads the media to the last sponsor's edge", () => {
    // The owner, 9 October: "Endorsed by" lined up under Hashed Emergent,
    // the media logos spread out rather than huddled in the middle.
    const lead = footer.sponsors[0];
    const row = footer.sponsors.filter((s) => Math.abs(s.y + s.h / 2 - (lead.y + lead.h / 2)) < 1);
    const leftmost = row.reduce((a, b) => (b.x < a.x ? b : a));
    expect(leftmost.logo.name).toBe("Hashed Emergent");
    const endorsed = footer.labels.find((l) => l.text === "ENDORSED BY")!;
    // Centred under the logo, unless the label is wider than a narrow logo
    // and would cross the picture's edge: then it moves in just enough.
    const under = leftmost.x + leftmost.w / 2;
    expect(endorsed.cx).toBeGreaterThanOrEqual(under - 1e-6);
    expect(endorsed.cx - under).toBeLessThan(40);
    const seal = footer.partners.find((p) => p.logo.name === "Lagos State Government")!;
    expect(seal.x + seal.w / 2).toBeCloseTo(endorsed.cx, 3);
    const rightEdge = Math.max(...row.map((s) => s.x + s.w));
    const media = footer.partners.filter((p) => p.logo.name !== "Lagos State Government");
    const lines = new Map<number, typeof media>();
    for (const p of media) {
      const key = Math.round(p.y + p.h / 2);
      const near = [...lines.keys()].find((k) => Math.abs(k - key) < 30) ?? key;
      lines.set(near, [...(lines.get(near) ?? []), p]);
    }
    expect(lines.size).toBeGreaterThanOrEqual(1);
    const sep = footer.separators[0].x;
    for (const line of lines.values()) {
      const first = line.reduce((a, b) => (b.x < a.x ? b : a));
      const last = line.reduce((a, b) => (b.x + b.w > a.x + a.w ? b : a));
      expect(first.x).toBeGreaterThan(sep);
      // Each line reaches the sponsors' right edge (spread, not centred).
      expect(last.x + last.w).toBeCloseTo(rightEdge, 0);
    }
  });

  it("lets a stacked lockup stand as tall as the headline, and leaves the wordmarks as they were", () => {
    // Microtraction's logo is its mark over a small word: at a wordmark's
    // height the word would be a speck.
    const mt = footer.sponsors.find((s) => s.logo.name === "Microtraction")!;
    // With a dozen logos sharing the row it is scaled down with the rest, but
    // still taller than the plain wordmarks and never taller than the headline.
    expect(mt.h).toBeLessThanOrEqual(FOOTER.headlineMaxH + 1e-9);
    const wordmarks = footer.sponsors.slice(1).filter((s) => s.w / s.h >= 2.5);
    expect(wordmarks.length).toBeGreaterThan(0);
    for (const s of wordmarks) {
      expect(s.h).toBeLessThanOrEqual(FOOTER.sponsorMaxH + 1e-9);
      expect(mt.h).toBeGreaterThan(s.h);
    }
  });

  it("carries none of the five media the owner took off the 2026 wall", () => {
    // The owner, 10 October: off the wall and the picture, after the DP alone (9 October).
    const removed = ["BusinessDay", "The Guardian", "Legit", "TechCabal", "Punch"];
    const onPicture = [...footer.sponsors, ...footer.partners].map((p) => p.logo.name);
    for (const name of removed) {
      expect(onPicture).not.toContain(name);
      expect(sponsors.some((p) => p.name === name)).toBe(false);
    }
    expect(onPicture).toContain("Techpoint");
    expect(onPicture).toContain("Microtraction");
  });

  it("keeps a logo marked onDp: false off the picture, though it stays on the wall", () => {
    const offPicture = { name: "Wall Only", tier: "Media", logo: "/2026/logos/wall-only.png", width: 400, height: 100, onDp: false };
    const withIt = footerTiers({ headline, sponsors: [...sponsors, offPicture], partners });
    const names = [withIt.headline, ...withIt.sponsors, ...withIt.groups.flatMap((g) => g.logos)]
      .filter((l) => l !== null)
      .map((l) => l!.name);
    expect(names).not.toContain("Wall Only");
    expect(names).toEqual([tiers.headline, ...tiers.sponsors, ...tiers.groups.flatMap((g) => g.logos)].filter((l) => l !== null).map((l) => l!.name));
  });

  it("endorses with Lagos State, then every media partner with no heading", () => {
    expect(tiers.groups.map((g) => [g.kind, g.label])).toEqual([
      ["Government", "ENDORSED BY"],
      ["Media", ""],
    ]);
    expect(tiers.groups[0].logos.map((l) => l.name)).toEqual(["Lagos State Government"]);
    expect(tiers.groups[1].logos.map((l) => l.name)).toEqual(
      onDp(sponsors.filter((s) => s.tier === "Media")),
    );
    expect(footer.partners.map((p) => p.logo.name)).toEqual(
      tiers.groups.flatMap((g) => g.logos.map((l) => l.name)),
    );
    // The owner, 9 October: no "Media partners" heading, just the logos.
    expect(footer.labels.map((l) => l.text)).toEqual(["ENDORSED BY"]);
  });

  it("keeps every partner logo legible on the 2160 post, in at most two lines", () => {
    expect(footer.partnerLines).toBeLessThanOrEqual(2);
    for (const p of footer.partners) {
      expect(p.h).toBeGreaterThanOrEqual(FOOTER.partnerMinH - 1e-9);
      expect(p.x).toBeGreaterThanOrEqual(FOOTER.edge - 1e-9);
      expect(p.x + p.w).toBeLessThanOrEqual(DP_SIZE - FOOTER.edge + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(footer.top);
      expect(p.y + p.h).toBeLessThanOrEqual(DP_SIZE);
    }
    const all = [...footer.sponsors, ...footer.partners];
    all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
  });

  it("shows a newly added sponsor or partner with no change to the drawing code", () => {
    const newcomer: Sponsor = {
      name: "Newco",
      tier: "Bronze",
      logo: "/2026/logos/newco.png",
      width: 900,
      height: 300,
    };
    const more: FooterTiers = footerTiers({
      headline,
      sponsors: [...sponsors, newcomer],
      partners: [
        ...partners,
        { name: "Lagos Builders", kind: "Community", logo: "/x.png", width: 600, height: 200 },
      ],
    });
    const laid = layoutFooter(more, measureLabel);
    expect(laid.sponsors.map((s) => s.logo.name)).toContain("Newco");
    expect(laid.partners.map((p) => p.logo.name)).toContain("Lagos Builders");
    // A community partner joins the unlabelled logos, like the media.
    expect(laid.labels.map((l) => l.text)).toEqual(["ENDORSED BY"]);
    expect(laid.sponsors[0].logo.name).toBe("Monica");
    for (const s of laid.sponsors) {
      expect(s.x).toBeGreaterThanOrEqual(FOOTER.edge - 1e-9);
      expect(s.x + s.w).toBeLessThanOrEqual(DP_SIZE - FOOTER.edge + 1e-9);
    }
  });

  it("never lets an extra sponsor shrink below the floor: the lowest tiers move to a line of their own", () => {
    const extra: Sponsor[] = [
      ...Array.from({ length: 8 }, (_, i) => ({
        name: `Extra ${i + 1}`,
        tier: "Community",
        logo: `/x${i}.png`,
        width: 900,
        height: 300,
      })),
      { name: "Very Wide", tier: "Community", logo: "/wide.png", width: 1280, height: 156 },
    ];
    const laid = layoutFooter(
      footerTiers({ headline, sponsors: [...sponsors, ...extra], partners }),
      measureLabel,
    );
    expect(laid.sponsors).toHaveLength(
      1 + tieredSponsors.length + extra.length + tierNames("Ecosystem").length,
    );
    for (const s of laid.sponsors) {
      expect(s.h).toBeGreaterThanOrEqual(FOOTER.sponsorMinH - 1e-9);
      expect(s.h).toBeGreaterThanOrEqual(FOOTER.partnerMinH - 1e-9);
      expect(s.x).toBeGreaterThanOrEqual(FOOTER.edge - 1e-9);
      expect(s.x + s.w).toBeLessThanOrEqual(DP_SIZE - FOOTER.edge + 1e-9);
    }
    const all = [...laid.sponsors, ...laid.partners];
    all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
    const [lead] = laid.sponsors;
    expect(lead.logo.name).toBe("Monica");
    expect(lead.x + lead.w / 2).toBeCloseTo(DP_SIZE / 2, 6);
    expect(insideCircleCrop(lead)).toBe(true);
    // The ones the wings could not take sit below the headline row, above the partners.
    const spilled = laid.sponsors.filter((s) => s.y > lead.y + lead.h);
    expect(spilled.map((s) => s.logo.name)).toContain("Very Wide");
    for (const s of spilled) expect(s.y + s.h).toBeLessThan(laid.divider!.y);
    // The footer grew for them, so the art above rebalances.
    expect(laid.top).toBeLessThan(footer.top);
  });

  it("puts every partner logo under its own kind's label, and never an unlabelled one under another's, however the lines wrap", () => {
    const check = (laid: ReturnType<typeof layoutFooter>, groups: FooterTiers["groups"]) => {
      const kindOf = new Map(groups.flatMap((g) => g.logos.map((l) => [l.name, g.label] as const)));
      const eps = 1e-6;
      for (const p of laid.partners) {
        const cx = p.x + p.w / 2;
        // The hairlines either side of this logo bound its column.
        const beside = laid.separators.filter((s) => s.y1 - eps <= p.y && p.y + p.h <= s.y2 + eps);
        const left = Math.max(-Infinity, ...beside.filter((s) => s.x < cx).map((s) => s.x));
        const right = Math.min(Infinity, ...beside.filter((s) => s.x > cx).map((s) => s.x));
        // The label a reader takes it to be under: the lowest one above it in
        // its column, and of those the nearest across.
        const [under] = laid.labels
          .filter((l) => l.baseline < p.y && l.cx > left && l.cx < right)
          .sort((a, b) => b.baseline - a.baseline || Math.abs(a.cx - cx) - Math.abs(b.cx - cx));
        // An unlabelled kind (the media) must not read as "ENDORSED BY".
        expect(under?.text ?? "", p.logo.name).toBe(kindOf.get(p.logo.name));
      }
    };
    check(footer, tiers.groups);
    // Many partners of several kinds: the labelled flow, every run labelled.
    const crowd = footerTiers({
      headline,
      sponsors,
      partners: [
        ...partners,
        ...Array.from({ length: 9 }, (_, i) => ({
          name: `Hub ${i}`,
          kind: "Community" as const,
          logo: `/hub${i}.png`,
          width: 900,
          height: 300,
        })),
      ],
    });
    check(layoutFooter(crowd, measureLabel), crowd.groups);
  });

  it("hands the browser an SVG with its recorded size on its root", () => {
    const svg = `<?xml version="1.0"?><svg width="100%" height='100%' viewBox="0 0 1200 300" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="5"/></svg>`;
    const sized = sizedSvg(svg, 5000, 1250);
    expect(sized).toContain(`<svg width="5000" height="1250" viewBox="0 0 1200 300"`);
    expect(sized).toContain(`<rect width="10" height="5"/>`);
    const resolved = footerTiers({ headline, sponsors, partners }, (l) =>
      l.logo.endsWith(".svg") ? "data:svg" : l.logo,
    );
    expect(resolved.sponsors.find((s) => s.name === "Cake Wallet")?.src).toBe("data:svg");
  });
});

describe("the circle crop a profile picture makes", () => {
  const art = layoutArt(footer.top, 667 / 164);

  it("keeps the mark, the photo, the role, the name and the headline sponsor", () => {
    expect(insideCircleCrop(art.logo)).toBe(true);
    const ring = art.ringR + ART.line / 2;
    expect(
      insideCircleCrop({ x: art.hub.x - ring, y: art.hub.y - ring, w: 2 * ring, h: 2 * ring }),
    ).toBe(true);
    // The pill, name and days live in this band, never wider than the name's room.
    expect(
      insideCircleCrop({
        x: DP_SIZE / 2 - NAME_MAX_W / 2,
        y: art.zoneTop,
        w: NAME_MAX_W,
        h: art.zoneBottom - art.zoneTop,
      }),
    ).toBe(true);
    expect(insideCircleCrop(footer.sponsors[0])).toBe(true);
  });

  it("leaves the art room to breathe above the taller footer", () => {
    expect(art.zoneBottom).toBeLessThanOrEqual(footer.top);
    expect(art.zoneBottom - art.zoneTop).toBeGreaterThanOrEqual(ART.textBlock);
    expect(art.photoR).toBeGreaterThanOrEqual(380);
    expect(art.hub.y - art.ringR - ART.line / 2).toBeGreaterThan(art.themeBaseline);
  });
});

describe("the role a link asks for", () => {
  it("is one of the four roles, or nothing", async () => {
    const { roleFromQuery } = await import("@/app/getdp/lib/dp");
    expect(roleFromQuery("?role=speaker")).toBe("speaker");
    expect(roleFromQuery("?role=volunteer&utm_source=x")).toBe("volunteer");
    expect(roleFromQuery("?role=partner")).toBe("partner");
    expect(roleFromQuery("?role=organiser")).toBeNull();
    expect(roleFromQuery("?role=SPEAKER")).toBeNull();
    expect(roleFromQuery("")).toBeNull();
  });
});

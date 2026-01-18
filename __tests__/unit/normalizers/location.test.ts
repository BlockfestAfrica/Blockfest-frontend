/**
 * Tests for location normalization utilities
 */

import { describe, it, expect } from "vitest";
import {
  normalizeCountry,
  normalizeLocation,
  normalizeTransportLocation,
  classifyTransportZone,
} from "@/lib/normalizers/location";

describe("normalizeCountry", () => {
  it("returns Nigeria for empty or null input", () => {
    expect(normalizeCountry("")).toBe("Nigeria");
    expect(normalizeCountry(null as unknown as string)).toBe("Nigeria");
  });

  it("returns Nigeria for common nil values", () => {
    expect(normalizeCountry("nil")).toBe("Nigeria");
    expect(normalizeCountry("none")).toBe("Nigeria");
    expect(normalizeCountry("n/a")).toBe("Nigeria");
    expect(normalizeCountry("null")).toBe("Nigeria");
  });

  it("normalizes Nigeria variants", () => {
    expect(normalizeCountry("nigeria")).toBe("Nigeria");
    expect(normalizeCountry("NIGERIA")).toBe("Nigeria");
    expect(normalizeCountry("Nigerian")).toBe("Nigeria");
    expect(normalizeCountry("ng")).toBe("Nigeria");
    expect(normalizeCountry("nigera")).toBe("Nigeria");
  });

  it("recognizes Nigerian cities as Nigeria", () => {
    expect(normalizeCountry("Lagos")).toBe("Nigeria");
    expect(normalizeCountry("Abuja")).toBe("Nigeria");
    expect(normalizeCountry("Ibadan")).toBe("Nigeria");
    expect(normalizeCountry("Port Harcourt")).toBe("Nigeria");
  });

  it("recognizes Nigerian states as Nigeria", () => {
    expect(normalizeCountry("Lagos State")).toBe("Nigeria");
    expect(normalizeCountry("Ogun State")).toBe("Nigeria");
    expect(normalizeCountry("Kwara State")).toBe("Nigeria");
  });

  it("recognizes international countries", () => {
    expect(normalizeCountry("ghana")).toBe("Ghana");
    expect(normalizeCountry("Kenya")).toBe("Kenya");
    expect(normalizeCountry("south africa")).toBe("South Africa");
    expect(normalizeCountry("usa")).toBe("United States");
    expect(normalizeCountry("uk")).toBe("United Kingdom");
  });

  it("handles non-location entries", () => {
    expect(normalizeCountry("University of Lagos")).toBe("Nigeria");
    expect(normalizeCountry("CEO, TechCorp")).toBe("Nigeria");
    expect(normalizeCountry("Blockchain Developer")).toBe("Nigeria");
  });
});

describe("normalizeLocation", () => {
  it("returns Nigeria for empty input", () => {
    expect(normalizeLocation("")).toBe("Nigeria");
    expect(normalizeLocation("  ")).toBe("Nigeria");
  });

  it("normalizes Lagos areas", () => {
    expect(normalizeLocation("Lagos")).toBe("Lagos, Nigeria");
    expect(normalizeLocation("Ikeja, Lagos")).toBe("Lagos, Nigeria");
    expect(normalizeLocation("Lekki")).toBe("Lagos, Nigeria");
    expect(normalizeLocation("Victoria Island")).toBe("Lagos, Nigeria");
    expect(normalizeLocation("Yaba")).toBe("Lagos, Nigeria");
  });

  it("normalizes Abuja variations", () => {
    expect(normalizeLocation("Abuja")).toBe("Abuja, Nigeria");
    expect(normalizeLocation("FCT")).toBe("Abuja, Nigeria");
    expect(normalizeLocation("FCT, Nigeria")).toBe("Abuja, Nigeria");
  });

  it("normalizes other major cities", () => {
    expect(normalizeLocation("Ibadan")).toBe("Ibadan, Nigeria");
    expect(normalizeLocation("Port Harcourt")).toBe("Port Harcourt, Nigeria");
    expect(normalizeLocation("Enugu")).toBe("Enugu, Nigeria");
  });

  it("normalizes Ogun state areas", () => {
    expect(normalizeLocation("Abeokuta")).toBe("Ogun State, Nigeria");
    expect(normalizeLocation("Sagamu")).toBe("Ogun State, Nigeria");
    expect(normalizeLocation("Ota")).toBe("Ogun State, Nigeria");
  });

  it("handles international locations", () => {
    expect(normalizeLocation("Nairobi, Kenya")).toBe("Kenya");
    expect(normalizeLocation("Accra, Ghana")).toBe("Ghana");
    expect(normalizeLocation("London, UK")).toBe("United Kingdom");
  });

  it("handles non-location entries", () => {
    expect(normalizeLocation("University of Lagos")).toBe("Nigeria");
    expect(normalizeLocation("Founder, Startup Inc")).toBe("Nigeria");
  });
});

describe("normalizeTransportLocation", () => {
  it("handles empty input", () => {
    expect(normalizeTransportLocation("")).toBe("");
    expect(normalizeTransportLocation(null as unknown as string)).toBe("");
  });

  it("normalizes case and whitespace", () => {
    expect(normalizeTransportLocation("  IKEJA  ")).toBe("Ikeja");
    expect(normalizeTransportLocation("lekki")).toBe("Lekki");
  });

  it("canonicalizes VI to Victoria Island", () => {
    expect(normalizeTransportLocation("V.I")).toBe("Victoria Island");
    expect(normalizeTransportLocation("VI")).toBe("Victoria Island");
    expect(normalizeTransportLocation("v/i")).toBe("Victoria Island");
  });

  it("removes numbers to reduce PII", () => {
    expect(normalizeTransportLocation("5 Admiralty Way")).toBe("Admiralty Way");
    expect(normalizeTransportLocation("12 Marina Road")).toBe("Marina Road");
  });
});

describe("classifyTransportZone", () => {
  it("classifies Ikeja/Maryland area", () => {
    expect(classifyTransportZone("Ikeja")).toBe("Ikeja/Maryland Axis");
    expect(classifyTransportZone("Maryland")).toBe("Ikeja/Maryland Axis");
    expect(classifyTransportZone("Ojota")).toBe("Ikeja/Maryland Axis");
  });

  it("classifies Lagos Island/Surulere area", () => {
    expect(classifyTransportZone("Surulere")).toBe("Lagos Island/Surulere");
    expect(classifyTransportZone("Yaba")).toBe("Lagos Island/Surulere");
    expect(classifyTransportZone("Lagos Island")).toBe("Lagos Island/Surulere");
  });

  it("classifies Lekki/VI area", () => {
    expect(classifyTransportZone("Lekki")).toBe("Lekki/VI Axis");
    expect(classifyTransportZone("Victoria Island")).toBe("Lekki/VI Axis");
    expect(classifyTransportZone("Ajah")).toBe("Lekki/VI Axis");
  });

  it("classifies Festac/Satellite area", () => {
    expect(classifyTransportZone("Festac")).toBe("Festac/Satellite Town");
    expect(classifyTransportZone("Satellite Town")).toBe("Festac/Satellite Town");
  });

  it("returns Other for unknown locations", () => {
    expect(classifyTransportZone("Unknown Place")).toBe("Other");
    expect(classifyTransportZone("")).toBe("Other");
  });
});

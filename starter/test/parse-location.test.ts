import { describe, expect, it } from "vitest";
import {
  parseLocation,
  formatLocation,
  toRackLocationString,
  isDeployComplete,
} from "@/lib/parse-location";

describe("parseLocation", () => {
  it("parses a full 5-segment location", () => {
    expect(parseLocation("Lab-Building-A/Bay-12/Aisle-3/B-04/P-02")).toEqual({
      site: "Lab-Building-A",
      room: "Bay-12",
      row: "Aisle-3",
      rack: "B-04",
      ru: "P-02",
    });
  });

  it("parses a storage location with empty segments as null", () => {
    expect(parseLocation("Lab-Building-A/Storage-1//SHELF-3/")).toEqual({
      site: "Lab-Building-A",
      room: "Storage-1",
      row: null,
      rack: "SHELF-3",
      ru: null,
    });
  });
});

describe("toRackLocationString", () => {
  it("matches facilities rack_location serialization for full locations", () => {
    // The API seed (procedural.ts) builds rack_location with .filter(Boolean).join("/")
    // Our serialization must match for reconciliation comparison to work
    expect(toRackLocationString({
      site: "Lab-Building-B",
      room: "Computing-1",
      row: "Aisle-1",
      rack: "C-12",
      ru: "U18",
    })).toBe("Lab-Building-B/Computing-1/Aisle-1/C-12/U18");
  });

  it("drops null segments to match facilities format", () => {
    // Both sides use filter(Boolean) -- null segments are dropped, not preserved as empty strings
    expect(toRackLocationString({
      site: "A",
      room: "R1",
      row: null,
      rack: "RK1",
      ru: "U1",
    })).toBe("A/R1/RK1/U1");
  });
});

describe("isDeployComplete", () => {
  it("returns true when site, room, rack, and ru are all present", () => {
    expect(isDeployComplete({
      site: "A", room: "R1", row: null, rack: "RK1", ru: "U1",
    })).toBe(true);
  });

  it("returns false when ru is missing", () => {
    expect(isDeployComplete({
      site: "A", room: "R1", row: "W1", rack: "RK1", ru: null,
    })).toBe(false);
  });
});

describe("formatLocation", () => {
  it("joins non-null segments with separator", () => {
    expect(formatLocation({
      site: "A", room: "R1", row: null, rack: "RK1", ru: null,
    })).toBe("A / R1 / RK1");
  });
});

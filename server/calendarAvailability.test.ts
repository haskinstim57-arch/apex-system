import { describe, it, expect } from "vitest";

// Replicate the sanitizeAvailability logic from Calendar.tsx for testing
const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

type AvailabilityBlock = { start: string; end: string };
type WeeklyAvailability = {
  monday: AvailabilityBlock[];
  tuesday: AvailabilityBlock[];
  wednesday: AvailabilityBlock[];
  thursday: AvailabilityBlock[];
  friday: AvailabilityBlock[];
  saturday: AvailabilityBlock[];
  sunday: AvailabilityBlock[];
};

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday: [{ start: "09:00", end: "17:00" }],
  tuesday: [{ start: "09:00", end: "17:00" }],
  wednesday: [{ start: "09:00", end: "17:00" }],
  thursday: [{ start: "09:00", end: "17:00" }],
  friday: [{ start: "09:00", end: "17:00" }],
  saturday: [],
  sunday: [],
};

function sanitizeAvailability(raw: unknown): WeeklyAvailability {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_AVAILABILITY };
  const obj = raw as Record<string, unknown>;
  const result: WeeklyAvailability = { ...DEFAULT_AVAILABILITY };
  for (const day of DAY_NAMES) {
    const val = obj[day];
    if (Array.isArray(val)) {
      result[day] = val
        .filter((b: any) => b && typeof b.start === "string" && typeof b.end === "string")
        .map((b: any) => ({ start: b.start, end: b.end }));
    } else if (val && typeof val === "object") {
      const v = val as Record<string, unknown>;
      if (v.enabled && typeof v.start === "string" && typeof v.end === "string") {
        result[day] = [{ start: v.start as string, end: v.end as string }];
      } else {
        result[day] = [];
      }
    }
  }
  return result;
}

describe("sanitizeAvailability", () => {
  it("should return defaults when input is null", () => {
    const result = sanitizeAvailability(null);
    expect(result.monday).toEqual([{ start: "09:00", end: "17:00" }]);
    expect(result.saturday).toEqual([]);
  });

  it("should return defaults when input is undefined", () => {
    const result = sanitizeAvailability(undefined);
    expect(result.monday).toEqual([{ start: "09:00", end: "17:00" }]);
  });

  it("should return defaults when input is a string", () => {
    const result = sanitizeAvailability("not an object");
    expect(result.monday).toEqual([{ start: "09:00", end: "17:00" }]);
  });

  it("should return defaults when input is an empty object", () => {
    const result = sanitizeAvailability({});
    expect(result.monday).toEqual([{ start: "09:00", end: "17:00" }]);
    expect(result.friday).toEqual([{ start: "09:00", end: "17:00" }]);
    expect(result.saturday).toEqual([]);
  });

  it("should pass through valid array format", () => {
    const input = {
      monday: [{ start: "08:00", end: "16:00" }],
      tuesday: [{ start: "10:00", end: "18:00" }],
      wednesday: [],
      thursday: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "17:00" }],
      friday: [{ start: "09:00", end: "17:00" }],
      saturday: [],
      sunday: [],
    };
    const result = sanitizeAvailability(input);
    expect(result.monday).toEqual([{ start: "08:00", end: "16:00" }]);
    expect(result.tuesday).toEqual([{ start: "10:00", end: "18:00" }]);
    expect(result.wednesday).toEqual([]);
    expect(result.thursday).toHaveLength(2);
  });

  it("should convert { enabled: true, start, end } format to array format", () => {
    const input = {
      monday: { enabled: true, start: "09:00", end: "17:00" },
      tuesday: { enabled: true, start: "09:00", end: "17:00" },
      wednesday: { enabled: true, start: "09:00", end: "17:00" },
      thursday: { enabled: true, start: "09:00", end: "17:00" },
      friday: { enabled: true, start: "09:00", end: "17:00" },
      saturday: { enabled: false, start: "09:00", end: "17:00" },
      sunday: { enabled: false, start: "09:00", end: "17:00" },
    };
    const result = sanitizeAvailability(input);
    expect(result.monday).toEqual([{ start: "09:00", end: "17:00" }]);
    expect(result.saturday).toEqual([]);
    expect(result.sunday).toEqual([]);
  });

  it("should handle mixed formats (some days array, some object)", () => {
    const input = {
      monday: [{ start: "08:00", end: "16:00" }],
      tuesday: { enabled: true, start: "10:00", end: "18:00" },
      saturday: { enabled: false, start: "09:00", end: "17:00" },
    };
    const result = sanitizeAvailability(input);
    expect(result.monday).toEqual([{ start: "08:00", end: "16:00" }]);
    expect(result.tuesday).toEqual([{ start: "10:00", end: "18:00" }]);
    expect(result.saturday).toEqual([]);
    // Missing days should get defaults
    expect(result.wednesday).toEqual([{ start: "09:00", end: "17:00" }]);
  });

  it("should filter out malformed blocks in arrays", () => {
    const input = {
      monday: [
        { start: "09:00", end: "17:00" },
        { start: 9, end: 17 }, // invalid types
        null,
        { start: "10:00" }, // missing end
      ],
    };
    const result = sanitizeAvailability(input);
    expect(result.monday).toEqual([{ start: "09:00", end: "17:00" }]);
  });

  it("should handle partial object with only some days", () => {
    const input = {
      monday: [{ start: "07:00", end: "15:00" }],
      friday: [{ start: "10:00", end: "14:00" }],
    };
    const result = sanitizeAvailability(input);
    expect(result.monday).toEqual([{ start: "07:00", end: "15:00" }]);
    expect(result.friday).toEqual([{ start: "10:00", end: "14:00" }]);
    // Other days should keep defaults
    expect(result.tuesday).toEqual([{ start: "09:00", end: "17:00" }]);
    expect(result.saturday).toEqual([]);
  });

  it("should ensure all 7 days are present in the result", () => {
    const result = sanitizeAvailability({});
    for (const day of DAY_NAMES) {
      expect(result[day]).toBeDefined();
      expect(Array.isArray(result[day])).toBe(true);
    }
  });
});

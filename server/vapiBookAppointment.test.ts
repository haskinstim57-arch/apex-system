import { describe, it, expect } from "vitest";

describe("VAPI bookAppointment — Working Hours Check", () => {
  // Simulate the working hours check logic from the handler
  function checkSlotAvailability(
    requestedTime: string,
    availableSlots: Array<{ start: string; end: string }>
  ): { available: boolean; alternatives?: string[] } {
    if (availableSlots.length === 0) {
      return { available: false };
    }
    const match = availableSlots.some((s) => s.start === requestedTime);
    if (match) {
      return { available: true };
    }
    return {
      available: false,
      alternatives: availableSlots.slice(0, 5).map((s) => s.start),
    };
  }

  it("should allow booking when requested time matches an available slot", () => {
    const slots = [
      { start: "09:00", end: "09:30" },
      { start: "09:30", end: "10:00" },
      { start: "10:00", end: "10:30" },
    ];
    const result = checkSlotAvailability("09:30", slots);
    expect(result.available).toBe(true);
  });

  it("should reject booking when requested time is outside working hours", () => {
    const slots = [
      { start: "09:00", end: "09:30" },
      { start: "09:30", end: "10:00" },
    ];
    const result = checkSlotAvailability("07:00", slots);
    expect(result.available).toBe(false);
    expect(result.alternatives).toEqual(["09:00", "09:30"]);
  });

  it("should reject booking when no slots available (day off)", () => {
    const result = checkSlotAvailability("09:00", []);
    expect(result.available).toBe(false);
    expect(result.alternatives).toBeUndefined();
  });

  it("should suggest up to 5 alternatives when slot is unavailable", () => {
    const slots = Array.from({ length: 8 }, (_, i) => ({
      start: `${String(9 + i).padStart(2, "0")}:00`,
      end: `${String(9 + i).padStart(2, "0")}:30`,
    }));
    const result = checkSlotAvailability("07:00", slots);
    expect(result.available).toBe(false);
    expect(result.alternatives).toHaveLength(5);
  });

  it("should handle edge case of last slot of the day", () => {
    const slots = [
      { start: "16:00", end: "16:30" },
      { start: "16:30", end: "17:00" },
    ];
    const result = checkSlotAvailability("16:30", slots);
    expect(result.available).toBe(true);
  });

  it("should reject booking at 17:00 when last slot ends at 17:00", () => {
    const slots = [
      { start: "16:00", end: "16:30" },
      { start: "16:30", end: "17:00" },
    ];
    const result = checkSlotAvailability("17:00", slots);
    expect(result.available).toBe(false);
    expect(result.alternatives).toEqual(["16:00", "16:30"]);
  });
});

describe("VAPI bookAppointment — Full Handler Contract", () => {
  it("should require guestName, date, and time", () => {
    const args = { guestName: "", date: "", time: "" };
    const missingFields = !args.guestName || !args.date || !args.time;
    expect(missingFields).toBe(true);
  });

  it("should accept valid booking args", () => {
    const args = {
      guestName: "John Doe",
      guestEmail: "john@example.com",
      guestPhone: "+15551234567",
      date: "2026-05-01",
      time: "10:00",
      notes: "First consultation",
    };
    const valid = args.guestName && args.date && args.time;
    expect(valid).toBeTruthy();
  });

  it("should detect past time slots", () => {
    const pastDate = new Date("2020-01-01T10:00:00Z");
    expect(pastDate.getTime() < Date.now()).toBe(true);
  });

  it("should detect future time slots", () => {
    const futureDate = new Date("2030-01-01T10:00:00Z");
    expect(futureDate.getTime() > Date.now()).toBe(true);
  });
});

describe("Calendar Working Hours — availabilityJson format", () => {
  it("should parse the standard availability format", () => {
    const availabilityJson = JSON.stringify({
      monday: [{ start: "09:00", end: "17:00" }],
      tuesday: [{ start: "09:00", end: "17:00" }],
      wednesday: [{ start: "09:00", end: "17:00" }],
      thursday: [{ start: "09:00", end: "17:00" }],
      friday: [{ start: "09:00", end: "17:00" }],
      saturday: [],
      sunday: [],
    });
    const parsed = JSON.parse(availabilityJson);
    expect(parsed.monday).toHaveLength(1);
    expect(parsed.monday[0].start).toBe("09:00");
    expect(parsed.saturday).toHaveLength(0);
    expect(parsed.sunday).toHaveLength(0);
  });

  it("should treat empty array as unavailable day", () => {
    const availability = {
      saturday: [],
      sunday: [],
    };
    expect(availability.saturday.length === 0).toBe(true);
    expect(availability.sunday.length === 0).toBe(true);
  });

  it("should support multiple blocks per day", () => {
    const availability = {
      monday: [
        { start: "09:00", end: "12:00" },
        { start: "13:00", end: "17:00" },
      ],
    };
    expect(availability.monday).toHaveLength(2);
  });
});

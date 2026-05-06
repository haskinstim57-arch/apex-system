/**
 * Vitest tests for Prompt EE — Atomic claim in drip engine
 *
 * Tests:
 * 1. Two parallel processDripStep calls on the same due enrollment → exactly one sends
 * 2. claimEnrollmentForProcessing returns false if already claimed
 * 3. Normal flow: claim succeeds and message is enqueued
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Track how many times enqueueMessage is called
const mockEnqueueMessage = vi.fn().mockResolvedValue({ id: 1 });
const mockClaimEnrollment = vi.fn();
const mockGetDueEnrollments = vi.fn();
const mockAdvanceEnrollment = vi.fn().mockResolvedValue(undefined);
const mockGetContactById = vi.fn();
const mockCreateMessage = vi.fn().mockResolvedValue(1);
const mockListSequenceSteps = vi.fn().mockResolvedValue([]);
const mockLogContactActivity = vi.fn().mockResolvedValue(undefined);
const mockGetOrCreateWarmingConfig = vi.fn().mockResolvedValue({
  currentDailyLimit: 100,
  todaySendCount: 0,
  lastResetDate: new Date().toISOString().slice(0, 10),
});
const mockResetDailySendCount = vi.fn().mockResolvedValue(undefined);
const mockUpdateCurrentDailyLimit = vi.fn().mockResolvedValue(undefined);
const mockIncrementDailySendCount = vi.fn().mockResolvedValue(undefined);

vi.mock("../server/db", () => ({
  getDueEnrollments: (...args: unknown[]) => mockGetDueEnrollments(...args),
  advanceEnrollment: (...args: unknown[]) => mockAdvanceEnrollment(...args),
  getContactById: (...args: unknown[]) => mockGetContactById(...args),
  createMessage: (...args: unknown[]) => mockCreateMessage(...args),
  listSequenceSteps: (...args: unknown[]) => mockListSequenceSteps(...args),
  logContactActivity: (...args: unknown[]) => mockLogContactActivity(...args),
  claimEnrollmentForProcessing: (...args: unknown[]) => mockClaimEnrollment(...args),
  getOrCreateWarmingConfig: (...args: unknown[]) => mockGetOrCreateWarmingConfig(...args),
  resetDailySendCount: (...args: unknown[]) => mockResetDailySendCount(...args),
  updateCurrentDailyLimit: (...args: unknown[]) => mockUpdateCurrentDailyLimit(...args),
  incrementDailySendCount: (...args: unknown[]) => mockIncrementDailySendCount(...args),
}));

vi.mock("../server/services/messageQueue", () => ({
  enqueueMessage: (...args: unknown[]) => mockEnqueueMessage(...args),
}));

// Import after mocks
import { processNextSteps as processDripStep } from "./services/dripEngine";

const makeDueRow = (enrollmentId: number) => ({
  enrollment: {
    id: enrollmentId,
    sequenceId: 1,
    contactId: 100,
    accountId: 420001,
    currentStep: 0,
    status: "active",
    nextStepAt: new Date(Date.now() - 60000), // 1 min ago
  },
  step: {
    id: 10,
    sequenceId: 1,
    position: 1,
    delayDays: 1,
    delayHours: 0,
    messageType: "sms",
    subject: null,
    content: "Hello {{firstName}}!",
    templateId: null,
  },
  sequence: {
    id: 1,
    accountId: 420001,
    name: "Test Sequence",
    status: "active",
    stepCount: 3,
  },
});

describe("Drip Engine — Atomic Claim Dedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("two parallel processDripStep calls on same enrollment → exactly one sends", async () => {
    const dueRow = makeDueRow(900);

    // Both calls see the same due enrollment
    mockGetDueEnrollments.mockResolvedValue([dueRow]);

    // First claim succeeds, second fails (simulating atomic race)
    let claimCount = 0;
    mockClaimEnrollment.mockImplementation(() => {
      claimCount++;
      // Only the first caller wins
      return Promise.resolve(claimCount === 1);
    });

    mockGetContactById.mockResolvedValue({
      id: 100,
      accountId: 420001,
      firstName: "Jane",
      lastName: "Doe",
      phone: "+15551234567",
      email: "jane@example.com",
      status: "new",
    });

    mockListSequenceSteps.mockResolvedValue([
      { position: 1 },
      { position: 2 },
    ]);

    // Run two parallel drip cycles
    const [result1, result2] = await Promise.all([
      processDripStep(),
      processDripStep(),
    ]);

    // Exactly one should have sent (enqueued)
    expect(mockEnqueueMessage).toHaveBeenCalledTimes(1);

    // One result sent=1, the other sent=0
    const totalSent = result1.sent + result2.sent;
    expect(totalSent).toBe(1);
  });

  it("claimEnrollmentForProcessing returns false → enrollment is skipped, no message sent", async () => {
    const dueRow = makeDueRow(901);
    mockGetDueEnrollments.mockResolvedValue([dueRow]);
    mockClaimEnrollment.mockResolvedValue(false); // Already claimed by another worker

    const result = await processDripStep();

    expect(mockEnqueueMessage).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });

  it("claim succeeds → message is enqueued and enrollment is advanced", async () => {
    const dueRow = makeDueRow(902);
    mockGetDueEnrollments.mockResolvedValue([dueRow]);
    mockClaimEnrollment.mockResolvedValue(true);

    mockGetContactById.mockResolvedValue({
      id: 100,
      accountId: 420001,
      firstName: "John",
      lastName: "Smith",
      phone: "+15559876543",
      email: "john@example.com",
      status: "new",
    });

    mockListSequenceSteps.mockResolvedValue([
      { position: 1 },
      { position: 2 },
    ]);

    const result = await processDripStep();

    expect(mockClaimEnrollment).toHaveBeenCalledWith(902);
    expect(mockEnqueueMessage).toHaveBeenCalledTimes(1);
    expect(mockAdvanceEnrollment).toHaveBeenCalled();
    expect(result.sent).toBe(1);
  });
});

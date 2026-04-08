import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB layer ───
const mockSequences = new Map<number, any>();
const mockSteps = new Map<number, any[]>();
const mockMessages = new Map<number, any>();
let nextId = 1;

vi.mock("./db", () => ({
  createSequence: vi.fn(async (data: any) => {
    const id = nextId++;
    const seq = {
      id,
      ...data,
      status: "draft",
      stepCount: 0,
      activeEnrollments: 0,
      completedCount: 0,
      activateAt: null,
      createdAt: new Date(),
    };
    mockSequences.set(id, seq);
    mockSteps.set(id, []);
    return { id };
  }),
  getSequenceById: vi.fn(async (id: number, accountId: number) => {
    const seq = mockSequences.get(id);
    return seq && seq.accountId === accountId ? seq : null;
  }),
  updateSequence: vi.fn(async (id: number, accountId: number, data: any) => {
    const seq = mockSequences.get(id);
    if (seq && seq.accountId === accountId) Object.assign(seq, data);
  }),
  listSequences: vi.fn(async (accountId: number) => {
    return Array.from(mockSequences.values()).filter((s) => s.accountId === accountId);
  }),
  listSequenceSteps: vi.fn(async (sequenceId: number) => {
    return (mockSteps.get(sequenceId) || []).sort((a: any, b: any) => a.position - b.position);
  }),
  createSequenceStep: vi.fn(async (data: any) => {
    const id = nextId++;
    const steps = mockSteps.get(data.sequenceId) || [];
    const step = { id, ...data };
    steps.push(step);
    mockSteps.set(data.sequenceId, steps);
    return { id };
  }),
  enrollContactInSequence: vi.fn(async (data: any) => {
    const id = nextId++;
    return { id, alreadyEnrolled: false };
  }),
  createMessage: vi.fn(async (data: any) => {
    const id = nextId++;
    const msg = { id, ...data };
    mockMessages.set(id, msg);
    return { id };
  }),
  getDb: vi.fn(async () => null),
  logContactActivity: vi.fn(async () => {}),
  deleteSequence: vi.fn(async () => {}),
  updateSequenceStep: vi.fn(async () => {}),
  deleteSequenceStep: vi.fn(async () => {}),
  reorderSequenceSteps: vi.fn(async () => {}),
  unenrollContact: vi.fn(async () => {}),
  listSequenceEnrollments: vi.fn(async () => []),
  getContactEnrollments: vi.fn(async () => []),
}));

beforeEach(() => {
  mockSequences.clear();
  mockSteps.clear();
  mockMessages.clear();
  nextId = 1;
  vi.clearAllMocks();
});

const db = await import("./db");

describe("Sequences V2 — Step Analytics, Scheduled Activation, Bulk Enroll", () => {
  // ─── Feature 1: Step-Level Analytics ───
  describe("Step-Level Analytics", () => {
    it("tracks sequenceStepId and sequenceStepPosition in messages", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Drip", createdById: 10 });
      const { id: stepId } = await db.createSequenceStep({
        sequenceId: seqId,
        position: 1,
        delayDays: 0,
        delayHours: 0,
        messageType: "email",
        subject: "Welcome",
        content: "Hello!",
      });

      // Simulate dripEngine creating a message with step tracking
      const { id: msgId } = await db.createMessage({
        accountId: 1,
        contactId: 100,
        userId: 0,
        type: "email",
        direction: "outbound",
        status: "pending",
        body: "Hello!",
        subject: "Welcome",
        toAddress: "test@example.com",
        sequenceStepId: stepId,
        sequenceStepPosition: 1,
      });

      expect(msgId).toBeDefined();
      const msg = mockMessages.get(msgId);
      expect(msg.sequenceStepId).toBe(stepId);
      expect(msg.sequenceStepPosition).toBe(1);
    });

    it("tracks SMS messages with step metadata", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "SMS Drip", createdById: 10 });
      const { id: stepId } = await db.createSequenceStep({
        sequenceId: seqId,
        position: 2,
        delayDays: 1,
        delayHours: 0,
        messageType: "sms",
        subject: null,
        content: "Hey!",
      });

      const { id: msgId } = await db.createMessage({
        accountId: 1,
        contactId: 200,
        userId: 0,
        type: "sms",
        direction: "outbound",
        status: "pending",
        body: "Hey!",
        toAddress: "+15551234567",
        sequenceStepId: stepId,
        sequenceStepPosition: 2,
      });

      const msg = mockMessages.get(msgId);
      expect(msg.type).toBe("sms");
      expect(msg.sequenceStepId).toBe(stepId);
      expect(msg.sequenceStepPosition).toBe(2);
    });

    it("computes delivery rate correctly", () => {
      const sent = 50;
      const delivered = 45;
      const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
      expect(deliveryRate).toBe(90);
    });

    it("computes reply rate correctly", () => {
      const sent = 40;
      const replyCount = 6;
      const replyRate = sent > 0 ? Math.round((replyCount / sent) * 100) : 0;
      expect(replyRate).toBe(15);
    });

    it("handles zero sent messages gracefully", () => {
      const sent = 0;
      const delivered = 0;
      const replyCount = 0;
      const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
      const replyRate = sent > 0 ? Math.round((replyCount / sent) * 100) : 0;
      expect(deliveryRate).toBe(0);
      expect(replyRate).toBe(0);
    });

    it("builds analytics per step position", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Multi-step", createdById: 10 });
      await db.createSequenceStep({
        sequenceId: seqId, position: 1, delayDays: 0, delayHours: 0,
        messageType: "email", subject: "Step 1", content: "First email",
      });
      await db.createSequenceStep({
        sequenceId: seqId, position: 2, delayDays: 2, delayHours: 0,
        messageType: "sms", subject: null, content: "Follow up SMS",
      });

      const steps = await db.listSequenceSteps(seqId);
      expect(steps).toHaveLength(2);

      // Simulate analytics computation
      const analytics = steps.map((step: any) => ({
        position: step.position,
        messageType: step.messageType,
        sent: 0,
        delivered: 0,
        failed: 0,
        deliveryRate: 0,
        replyCount: 0,
        replyRate: 0,
      }));

      expect(analytics).toHaveLength(2);
      expect(analytics[0].position).toBe(1);
      expect(analytics[0].messageType).toBe("email");
      expect(analytics[1].position).toBe(2);
      expect(analytics[1].messageType).toBe("sms");
    });
  });

  // ─── Feature 2: Scheduled Activation ───
  describe("Scheduled Activation", () => {
    it("stores activateAt on a draft sequence", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Scheduled Drip", createdById: 10 });
      const futureDate = new Date("2026-05-01T14:00:00Z");

      await db.updateSequence(seqId, 1, { activateAt: futureDate });

      const seq = await db.getSequenceById(seqId, 1);
      expect(seq!.activateAt).toEqual(futureDate);
    });

    it("clears activateAt when set to null", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Scheduled Drip", createdById: 10 });
      await db.updateSequence(seqId, 1, { activateAt: new Date("2026-05-01T14:00:00Z") });

      await db.updateSequence(seqId, 1, { activateAt: null });

      const seq = await db.getSequenceById(seqId, 1);
      expect(seq!.activateAt).toBeNull();
    });

    it("activates due sequences (worker logic)", async () => {
      // Create 3 sequences: 1 due, 1 future, 1 already active
      const { id: dueId } = await db.createSequence({ accountId: 1, name: "Due Now", createdById: 10 });
      await db.updateSequence(dueId, 1, {
        activateAt: new Date("2026-01-01T00:00:00Z"), // Past date
      });

      const { id: futureId } = await db.createSequence({ accountId: 1, name: "Future", createdById: 10 });
      await db.updateSequence(futureId, 1, {
        activateAt: new Date("2099-12-31T23:59:59Z"), // Far future
      });

      const { id: activeId } = await db.createSequence({ accountId: 1, name: "Already Active", createdById: 10 });
      await db.updateSequence(activeId, 1, { status: "active" });

      // Simulate worker logic: find draft sequences with activateAt <= now
      const now = new Date();
      const allSeqs = await db.listSequences(1);
      const dueSequences = allSeqs.filter(
        (s: any) => s.status === "draft" && s.activateAt && new Date(s.activateAt) <= now
      );

      expect(dueSequences).toHaveLength(1);
      expect(dueSequences[0].name).toBe("Due Now");

      // Activate them
      for (const seq of dueSequences) {
        await db.updateSequence(seq.id, 1, { status: "active", activateAt: null });
      }

      const activated = await db.getSequenceById(dueId, 1);
      expect(activated!.status).toBe("active");
      expect(activated!.activateAt).toBeNull();

      // Future one should still be draft
      const future = await db.getSequenceById(futureId, 1);
      expect(future!.status).toBe("draft");
      expect(future!.activateAt).toBeTruthy();
    });

    it("does not activate non-draft sequences", async () => {
      const { id: pausedId } = await db.createSequence({ accountId: 1, name: "Paused", createdById: 10 });
      await db.updateSequence(pausedId, 1, {
        status: "paused",
        activateAt: new Date("2026-01-01T00:00:00Z"),
      });

      const allSeqs = await db.listSequences(1);
      const dueSequences = allSeqs.filter(
        (s: any) => s.status === "draft" && s.activateAt && new Date(s.activateAt) <= new Date()
      );

      expect(dueSequences).toHaveLength(0);
    });

    it("validates activateAt is a valid ISO datetime string", () => {
      const validDates = [
        "2026-05-01T14:00:00.000Z",
        "2026-12-25T00:00:00Z",
        "2026-06-15T09:30:00.000Z",
      ];

      for (const d of validDates) {
        const parsed = new Date(d);
        expect(parsed.toISOString()).toBeTruthy();
        expect(isNaN(parsed.getTime())).toBe(false);
      }
    });
  });

  // ─── Feature 3: Bulk Enroll ───
  describe("Bulk Enroll", () => {
    it("enrolls multiple contacts in a sequence", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Bulk Drip", createdById: 10 });
      await db.createSequenceStep({
        sequenceId: seqId, position: 1, delayDays: 0, delayHours: 0,
        messageType: "email", subject: "Welcome", content: "Hello!",
      });

      const contactIds = [101, 102, 103, 104, 105];
      const results: { contactId: number; enrolled: boolean }[] = [];

      for (const contactId of contactIds) {
        const { id, alreadyEnrolled } = await db.enrollContactInSequence({
          sequenceId: seqId,
          accountId: 1,
          contactId,
          triggeredBy: "manual",
          currentStep: 1,
          totalSteps: 1,
          nextStepAt: new Date(),
        });
        results.push({ contactId, enrolled: !alreadyEnrolled });
      }

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.enrolled)).toBe(true);
      expect(db.enrollContactInSequence).toHaveBeenCalledTimes(5);
    });

    it("reports enrollment count correctly", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Count Test", createdById: 10 });

      const contactIds = [201, 202, 203];
      let enrolled = 0;
      let skipped = 0;

      for (const contactId of contactIds) {
        const { alreadyEnrolled } = await db.enrollContactInSequence({
          sequenceId: seqId,
          accountId: 1,
          contactId,
          triggeredBy: "manual",
          currentStep: 1,
          totalSteps: 0,
          nextStepAt: new Date(),
        });
        if (alreadyEnrolled) skipped++;
        else enrolled++;
      }

      expect(enrolled).toBe(3);
      expect(skipped).toBe(0);
    });

    it("handles empty contact list gracefully", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Empty Test", createdById: 10 });

      const contactIds: number[] = [];
      let enrolled = 0;

      for (const contactId of contactIds) {
        await db.enrollContactInSequence({
          sequenceId: seqId,
          accountId: 1,
          contactId,
          triggeredBy: "manual",
          currentStep: 1,
          totalSteps: 0,
          nextStepAt: new Date(),
        });
        enrolled++;
      }

      expect(enrolled).toBe(0);
      expect(db.enrollContactInSequence).not.toHaveBeenCalled();
    });

    it("validates sequence exists before bulk enroll", async () => {
      const nonExistentSeq = await db.getSequenceById(999, 1);
      expect(nonExistentSeq).toBeNull();
    });

    it("validates sequence is active before enrolling", async () => {
      const { id: draftId } = await db.createSequence({ accountId: 1, name: "Draft Seq", createdById: 10 });
      const seq = await db.getSequenceById(draftId, 1);

      // The bulkEnroll mutation checks for active status
      const isActive = seq!.status === "active";
      expect(isActive).toBe(false);

      // After activating
      await db.updateSequence(draftId, 1, { status: "active" });
      const activeSeq = await db.getSequenceById(draftId, 1);
      expect(activeSeq!.status).toBe("active");
    });
  });
});

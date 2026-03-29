import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB layer ───
const mockSequences = new Map<number, any>();
const mockSteps = new Map<number, any[]>();
const mockEnrollments = new Map<number, any>();
let nextId = 1;

vi.mock("./db", () => ({
  createSequence: vi.fn(async (data: any) => {
    const id = nextId++;
    const seq = { id, ...data, status: "draft", stepCount: 0, activeEnrollments: 0, completedCount: 0, createdAt: new Date() };
    mockSequences.set(id, seq);
    mockSteps.set(id, []);
    return { id };
  }),
  listSequences: vi.fn(async (accountId: number) => {
    return Array.from(mockSequences.values()).filter((s) => s.accountId === accountId);
  }),
  getSequenceById: vi.fn(async (id: number, accountId: number) => {
    const seq = mockSequences.get(id);
    return seq && seq.accountId === accountId ? seq : null;
  }),
  updateSequence: vi.fn(async (id: number, accountId: number, data: any) => {
    const seq = mockSequences.get(id);
    if (seq && seq.accountId === accountId) {
      Object.assign(seq, data);
    }
  }),
  deleteSequence: vi.fn(async (id: number, accountId: number) => {
    const seq = mockSequences.get(id);
    if (seq && seq.accountId === accountId) {
      mockSequences.delete(id);
      mockSteps.delete(id);
    }
  }),
  createSequenceStep: vi.fn(async (data: any) => {
    const id = nextId++;
    const steps = mockSteps.get(data.sequenceId) || [];
    const step = { id, ...data };
    steps.push(step);
    mockSteps.set(data.sequenceId, steps);
    return { id };
  }),
  listSequenceSteps: vi.fn(async (sequenceId: number) => {
    return (mockSteps.get(sequenceId) || []).sort((a: any, b: any) => a.position - b.position);
  }),
  updateSequenceStep: vi.fn(async (id: number, sequenceId: number, data: any) => {
    const steps = mockSteps.get(sequenceId) || [];
    const step = steps.find((s: any) => s.id === id);
    if (step) Object.assign(step, data);
  }),
  deleteSequenceStep: vi.fn(async (id: number, sequenceId: number) => {
    const steps = mockSteps.get(sequenceId) || [];
    mockSteps.set(sequenceId, steps.filter((s: any) => s.id !== id));
  }),
  reorderSequenceSteps: vi.fn(async (sequenceId: number, stepIds: number[]) => {
    const steps = mockSteps.get(sequenceId) || [];
    stepIds.forEach((sid, idx) => {
      const step = steps.find((s: any) => s.id === sid);
      if (step) step.position = idx + 1;
    });
  }),
  enrollContactInSequence: vi.fn(async (data: any) => {
    // Check for existing active enrollment
    const existing = Array.from(mockEnrollments.values()).find(
      (e) => e.contactId === data.contactId && e.sequenceId === data.sequenceId && e.status === "active"
    );
    if (existing) return { id: existing.id, alreadyEnrolled: true };
    const id = nextId++;
    const enrollment = { id, ...data, enrolledAt: new Date() };
    mockEnrollments.set(id, enrollment);
    return { id, alreadyEnrolled: false };
  }),
  unenrollContact: vi.fn(async (enrollmentId: number) => {
    const enrollment = mockEnrollments.get(enrollmentId);
    if (enrollment) enrollment.status = "unenrolled";
  }),
  listSequenceEnrollments: vi.fn(async (sequenceId: number, _accountId: number, status?: string) => {
    return Array.from(mockEnrollments.values()).filter(
      (e) => e.sequenceId === sequenceId && (!status || e.status === status)
    );
  }),
  getContactEnrollments: vi.fn(async (contactId: number) => {
    return Array.from(mockEnrollments.values()).filter((e) => e.contactId === contactId);
  }),
  logContactActivity: vi.fn(async () => {}),
}));

beforeEach(() => {
  mockSequences.clear();
  mockSteps.clear();
  mockEnrollments.clear();
  nextId = 1;
  vi.clearAllMocks();
});

// ─── Import after mocks ───
const db = await import("./db");

describe("Sequences Module", () => {
  // ─── Sequence CRUD ───
  describe("Sequence CRUD", () => {
    it("creates a sequence and retrieves it", async () => {
      const { id } = await db.createSequence({
        accountId: 1,
        name: "New Lead Nurture",
        description: "Follow-up drip for new leads",
        createdById: 10,
      });
      expect(id).toBe(1);

      const seq = await db.getSequenceById(id, 1);
      expect(seq).toBeTruthy();
      expect(seq!.name).toBe("New Lead Nurture");
      expect(seq!.status).toBe("draft");
    });

    it("lists sequences filtered by account", async () => {
      await db.createSequence({ accountId: 1, name: "Seq A", createdById: 10 });
      await db.createSequence({ accountId: 2, name: "Seq B", createdById: 20 });
      await db.createSequence({ accountId: 1, name: "Seq C", createdById: 10 });

      const account1 = await db.listSequences(1);
      expect(account1).toHaveLength(2);

      const account2 = await db.listSequences(2);
      expect(account2).toHaveLength(1);
    });

    it("updates sequence status", async () => {
      const { id } = await db.createSequence({ accountId: 1, name: "Test", createdById: 10 });
      await db.updateSequence(id, 1, { status: "active" });

      const seq = await db.getSequenceById(id, 1);
      expect(seq!.status).toBe("active");
    });

    it("deletes a sequence", async () => {
      const { id } = await db.createSequence({ accountId: 1, name: "To Delete", createdById: 10 });
      await db.deleteSequence(id, 1);

      const seq = await db.getSequenceById(id, 1);
      expect(seq).toBeNull();
    });

    it("prevents cross-account access", async () => {
      const { id } = await db.createSequence({ accountId: 1, name: "Private", createdById: 10 });
      const seq = await db.getSequenceById(id, 999);
      expect(seq).toBeNull();
    });
  });

  // ─── Steps ───
  describe("Sequence Steps", () => {
    it("adds steps in order", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Multi-Step", createdById: 10 });

      await db.createSequenceStep({
        sequenceId: seqId,
        position: 1,
        delayDays: 0,
        delayHours: 0,
        messageType: "email",
        subject: "Welcome!",
        content: "Hi {{firstName}}, welcome aboard!",
      });

      await db.createSequenceStep({
        sequenceId: seqId,
        position: 2,
        delayDays: 1,
        delayHours: 0,
        messageType: "sms",
        content: "Just checking in, {{firstName}}!",
      });

      await db.createSequenceStep({
        sequenceId: seqId,
        position: 3,
        delayDays: 3,
        delayHours: 12,
        messageType: "email",
        subject: "Quick question",
        content: "Have you had a chance to review?",
      });

      const steps = await db.listSequenceSteps(seqId);
      expect(steps).toHaveLength(3);
      expect(steps[0].position).toBe(1);
      expect(steps[0].messageType).toBe("email");
      expect(steps[1].position).toBe(2);
      expect(steps[1].messageType).toBe("sms");
      expect(steps[2].delayDays).toBe(3);
      expect(steps[2].delayHours).toBe(12);
    });

    it("updates a step", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Test", createdById: 10 });
      const { id: stepId } = await db.createSequenceStep({
        sequenceId: seqId,
        position: 1,
        delayDays: 1,
        delayHours: 0,
        messageType: "email",
        subject: "Old Subject",
        content: "Old content",
      });

      await db.updateSequenceStep(stepId, seqId, { subject: "New Subject", content: "New content" });

      const steps = await db.listSequenceSteps(seqId);
      expect(steps[0].subject).toBe("New Subject");
      expect(steps[0].content).toBe("New content");
    });

    it("deletes a step", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Test", createdById: 10 });
      const { id: stepId } = await db.createSequenceStep({
        sequenceId: seqId,
        position: 1,
        delayDays: 0,
        delayHours: 0,
        messageType: "sms",
        content: "Hello",
      });

      await db.deleteSequenceStep(stepId, seqId);
      const steps = await db.listSequenceSteps(seqId);
      expect(steps).toHaveLength(0);
    });

    it("reorders steps", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Reorder", createdById: 10 });
      const { id: s1 } = await db.createSequenceStep({ sequenceId: seqId, position: 1, delayDays: 0, delayHours: 0, messageType: "email", content: "Step 1" });
      const { id: s2 } = await db.createSequenceStep({ sequenceId: seqId, position: 2, delayDays: 1, delayHours: 0, messageType: "sms", content: "Step 2" });
      const { id: s3 } = await db.createSequenceStep({ sequenceId: seqId, position: 3, delayDays: 2, delayHours: 0, messageType: "email", content: "Step 3" });

      // Reverse order
      await db.reorderSequenceSteps(seqId, [s3, s2, s1]);

      const steps = await db.listSequenceSteps(seqId);
      const step3 = steps.find((s: any) => s.id === s3);
      const step1 = steps.find((s: any) => s.id === s1);
      expect(step3!.position).toBe(1);
      expect(step1!.position).toBe(3);
    });
  });

  // ─── Enrollments ───
  describe("Enrollments", () => {
    it("enrolls a contact in a sequence", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Enroll Test", createdById: 10 });
      const { id, alreadyEnrolled } = await db.enrollContactInSequence({
        sequenceId: seqId,
        contactId: 100,
        accountId: 1,
        currentStep: 0,
        status: "active",
        nextStepAt: new Date(Date.now() + 86400000),
        enrollmentSource: "manual",
      });

      expect(id).toBeTruthy();
      expect(alreadyEnrolled).toBe(false);
    });

    it("prevents duplicate active enrollments", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Dedup Test", createdById: 10 });

      const first = await db.enrollContactInSequence({
        sequenceId: seqId,
        contactId: 100,
        accountId: 1,
        currentStep: 0,
        status: "active",
        nextStepAt: new Date(),
        enrollmentSource: "manual",
      });
      expect(first.alreadyEnrolled).toBe(false);

      const second = await db.enrollContactInSequence({
        sequenceId: seqId,
        contactId: 100,
        accountId: 1,
        currentStep: 0,
        status: "active",
        nextStepAt: new Date(),
        enrollmentSource: "workflow",
      });
      expect(second.alreadyEnrolled).toBe(true);
      expect(second.id).toBe(first.id);
    });

    it("unenrolls a contact", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Unenroll Test", createdById: 10 });
      const { id: enrollId } = await db.enrollContactInSequence({
        sequenceId: seqId,
        contactId: 100,
        accountId: 1,
        currentStep: 0,
        status: "active",
        nextStepAt: new Date(),
        enrollmentSource: "manual",
      });

      await db.unenrollContact(enrollId);

      const enrollments = await db.listSequenceEnrollments(seqId, 1, "active");
      expect(enrollments).toHaveLength(0);

      const unenrolled = await db.listSequenceEnrollments(seqId, 1, "unenrolled");
      expect(unenrolled).toHaveLength(1);
    });

    it("lists enrollments with status filter", async () => {
      const { id: seqId } = await db.createSequence({ accountId: 1, name: "Filter Test", createdById: 10 });

      await db.enrollContactInSequence({
        sequenceId: seqId, contactId: 100, accountId: 1,
        currentStep: 0, status: "active", nextStepAt: new Date(), enrollmentSource: "manual",
      });
      await db.enrollContactInSequence({
        sequenceId: seqId, contactId: 200, accountId: 1,
        currentStep: 0, status: "active", nextStepAt: new Date(), enrollmentSource: "campaign",
      });

      const all = await db.listSequenceEnrollments(seqId, 1);
      expect(all).toHaveLength(2);

      const active = await db.listSequenceEnrollments(seqId, 1, "active");
      expect(active).toHaveLength(2);
    });
  });

  // ─── Drip Engine ───
  describe("Drip Engine", () => {
    it("computes first step delay correctly", async () => {
      const { computeFirstStepAt } = await import("./services/dripEngine");

      const immediate = computeFirstStepAt(0, 0);
      expect(immediate.getTime()).toBeLessThanOrEqual(Date.now() + 60001);

      const oneDay = computeFirstStepAt(1, 0);
      const expectedOneDay = Date.now() + 24 * 60 * 60 * 1000;
      expect(Math.abs(oneDay.getTime() - expectedOneDay)).toBeLessThan(1000);

      const twoDaysSixHours = computeFirstStepAt(2, 6);
      const expectedTwoDaysSixHours = Date.now() + (2 * 24 + 6) * 60 * 60 * 1000;
      expect(Math.abs(twoDaysSixHours.getTime() - expectedTwoDaysSixHours)).toBeLessThan(1000);
    });
  });
});

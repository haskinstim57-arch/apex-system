import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB layer ───
const mockSequences = new Map<number, any>();
const mockSteps = new Map<number, any[]>();
const mockEnrollments = new Map<number, any>();
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
      createdAt: new Date(),
    };
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
    if (seq && seq.accountId === accountId) Object.assign(seq, data);
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
  deleteSequenceStep: vi.fn(async () => {}),
  reorderSequenceSteps: vi.fn(async () => {}),
  enrollContactInSequence: vi.fn(async (data: any) => {
    const id = nextId++;
    const enrollment = { id, ...data, enrolledAt: new Date() };
    mockEnrollments.set(id, enrollment);
    return { id, alreadyEnrolled: false };
  }),
  unenrollContact: vi.fn(async () => {}),
  listSequenceEnrollments: vi.fn(async () => []),
  getContactEnrollments: vi.fn(async () => []),
  logContactActivity: vi.fn(async () => {}),
  getDb: vi.fn(async () => null),
}));

beforeEach(() => {
  mockSequences.clear();
  mockSteps.clear();
  mockEnrollments.clear();
  nextId = 1;
  vi.clearAllMocks();
});

const db = await import("./db");

describe("Sequence Features — updatePlaceholders, getStats, clone", () => {
  // ─── Feature 1: updatePlaceholders ───
  describe("updatePlaceholders logic", () => {
    it("replaces placeholders in step content", async () => {
      const { id: seqId } = await db.createSequence({
        accountId: 1,
        name: "[TEMPLATE] Webinar Invite",
        createdById: 10,
      });

      await db.createSequenceStep({
        sequenceId: seqId,
        position: 1,
        delayDays: 0,
        delayHours: 0,
        messageType: "email",
        subject: "Join us on [WEBINAR DATE]",
        content: "Hi {{firstName}}, our webinar is on [WEBINAR DATE] at [WEBINAR TIME]. Join here: [WEBINAR LINK]",
      });

      await db.createSequenceStep({
        sequenceId: seqId,
        position: 2,
        delayDays: 1,
        delayHours: 0,
        messageType: "sms",
        subject: null,
        content: "Reminder: Webinar tomorrow at [WEBINAR TIME]! Link: [WEBINAR LINK]",
      });

      // Simulate the updatePlaceholders logic
      const steps = await db.listSequenceSteps(seqId);
      const replacements = [
        { placeholder: "[WEBINAR DATE]", value: "Tuesday, April 15th" },
        { placeholder: "[WEBINAR TIME]", value: "7:00 PM EST" },
        { placeholder: "[WEBINAR LINK]", value: "https://zoom.us/j/123" },
      ];

      let updatedSteps = 0;
      for (const step of steps) {
        let content = step.content;
        let subject = step.subject || "";
        let changed = false;
        for (const { placeholder, value } of replacements) {
          if (content.includes(placeholder)) {
            content = content.split(placeholder).join(value);
            changed = true;
          }
          if (subject.includes(placeholder)) {
            subject = subject.split(placeholder).join(value);
            changed = true;
          }
        }
        if (changed) {
          const data: Record<string, unknown> = { content };
          if (step.subject !== null) data.subject = subject;
          await db.updateSequenceStep(step.id, seqId, data);
          updatedSteps++;
        }
      }

      expect(updatedSteps).toBe(2);

      // Verify step 1 was updated
      const updatedStepsArr = await db.listSequenceSteps(seqId);
      expect(updatedStepsArr[0].content).toContain("Tuesday, April 15th");
      expect(updatedStepsArr[0].content).toContain("7:00 PM EST");
      expect(updatedStepsArr[0].content).toContain("https://zoom.us/j/123");
      expect(updatedStepsArr[0].subject).toContain("Tuesday, April 15th");

      // Verify step 2 was updated
      expect(updatedStepsArr[1].content).toContain("7:00 PM EST");
      expect(updatedStepsArr[1].content).toContain("https://zoom.us/j/123");
    });

    it("does not update steps without matching placeholders", async () => {
      const { id: seqId } = await db.createSequence({
        accountId: 1,
        name: "Regular Sequence",
        createdById: 10,
      });

      await db.createSequenceStep({
        sequenceId: seqId,
        position: 1,
        delayDays: 0,
        delayHours: 0,
        messageType: "email",
        subject: "Welcome!",
        content: "Hi {{firstName}}, welcome to our program!",
      });

      const steps = await db.listSequenceSteps(seqId);
      const replacements = [
        { placeholder: "[WEBINAR DATE]", value: "Tuesday, April 15th" },
      ];

      let updatedSteps = 0;
      for (const step of steps) {
        let content = step.content;
        let subject = step.subject || "";
        let changed = false;
        for (const { placeholder, value } of replacements) {
          if (content.includes(placeholder)) {
            content = content.split(placeholder).join(value);
            changed = true;
          }
          if (subject.includes(placeholder)) {
            subject = subject.split(placeholder).join(value);
            changed = true;
          }
        }
        if (changed) updatedSteps++;
      }

      expect(updatedSteps).toBe(0);
    });

    it("replaces multiple occurrences of the same placeholder", async () => {
      const { id: seqId } = await db.createSequence({
        accountId: 1,
        name: "[TEMPLATE] Multi-Mention",
        createdById: 10,
      });

      await db.createSequenceStep({
        sequenceId: seqId,
        position: 1,
        delayDays: 0,
        delayHours: 0,
        messageType: "email",
        subject: "[WEBINAR DATE] - Don't miss it!",
        content: "Join us on [WEBINAR DATE]. Mark your calendar for [WEBINAR DATE].",
      });

      const steps = await db.listSequenceSteps(seqId);
      const replacements = [
        { placeholder: "[WEBINAR DATE]", value: "April 15th" },
      ];

      for (const step of steps) {
        let content = step.content;
        let subject = step.subject || "";
        for (const { placeholder, value } of replacements) {
          content = content.split(placeholder).join(value);
          subject = subject.split(placeholder).join(value);
        }
        await db.updateSequenceStep(step.id, seqId, { content, subject });
      }

      const updated = await db.listSequenceSteps(seqId);
      expect(updated[0].content).toBe("Join us on April 15th. Mark your calendar for April 15th.");
      expect(updated[0].subject).toBe("April 15th - Don't miss it!");
    });

    it("replaces [CALENDAR LINK] placeholder", async () => {
      const { id: seqId } = await db.createSequence({
        accountId: 1,
        name: "[TEMPLATE] Calendar Test",
        createdById: 10,
      });

      await db.createSequenceStep({
        sequenceId: seqId,
        position: 1,
        delayDays: 0,
        delayHours: 0,
        messageType: "email",
        subject: "Save the date",
        content: "Add to calendar: [CALENDAR LINK]",
      });

      const steps = await db.listSequenceSteps(seqId);
      const replacements = [
        { placeholder: "[CALENDAR LINK]", value: "https://calendly.com/event123" },
      ];

      for (const step of steps) {
        let content = step.content;
        for (const { placeholder, value } of replacements) {
          content = content.split(placeholder).join(value);
        }
        await db.updateSequenceStep(step.id, seqId, { content });
      }

      const updated = await db.listSequenceSteps(seqId);
      expect(updated[0].content).toBe("Add to calendar: https://calendly.com/event123");
    });
  });

  // ─── Feature 3: Clone Sequence ───
  describe("clone logic", () => {
    it("clones a sequence with all steps", async () => {
      const { id: origId } = await db.createSequence({
        accountId: 1,
        name: "Original Sequence",
        description: "The original",
        createdById: 10,
      });

      await db.createSequenceStep({
        sequenceId: origId,
        position: 1,
        delayDays: 0,
        delayHours: 0,
        messageType: "email",
        subject: "Welcome",
        content: "Hello {{firstName}}!",
        templateId: null,
      });

      await db.createSequenceStep({
        sequenceId: origId,
        position: 2,
        delayDays: 2,
        delayHours: 6,
        messageType: "sms",
        subject: null,
        content: "Follow up SMS",
        templateId: null,
      });

      // Simulate clone logic
      const seq = await db.getSequenceById(origId, 1);
      expect(seq).toBeTruthy();

      const steps = await db.listSequenceSteps(origId);
      expect(steps).toHaveLength(2);

      const newName = `Copy of ${seq!.name}`;
      const { id: newId } = await db.createSequence({
        accountId: 1,
        name: newName,
        description: seq!.description || null,
        createdById: 10,
      });

      for (const step of steps) {
        await db.createSequenceStep({
          sequenceId: newId,
          position: step.position,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          messageType: step.messageType,
          subject: step.subject || null,
          content: step.content,
          templateId: step.templateId || null,
        });
      }

      // Verify the clone
      const clonedSeq = await db.getSequenceById(newId, 1);
      expect(clonedSeq!.name).toBe("Copy of Original Sequence");
      expect(clonedSeq!.description).toBe("The original");
      expect(clonedSeq!.status).toBe("draft");

      const clonedSteps = await db.listSequenceSteps(newId);
      expect(clonedSteps).toHaveLength(2);
      expect(clonedSteps[0].position).toBe(1);
      expect(clonedSteps[0].messageType).toBe("email");
      expect(clonedSteps[0].content).toBe("Hello {{firstName}}!");
      expect(clonedSteps[1].position).toBe(2);
      expect(clonedSteps[1].delayDays).toBe(2);
      expect(clonedSteps[1].delayHours).toBe(6);
    });

    it("detects template sequences for auto-configure", async () => {
      const { id: templateId } = await db.createSequence({
        accountId: 1,
        name: "[TEMPLATE] Webinar Invite",
        createdById: 10,
      });

      const seq = await db.getSequenceById(templateId, 1);
      const isTemplate = seq!.name.includes("[TEMPLATE]");
      expect(isTemplate).toBe(true);

      // Non-template
      const { id: regularId } = await db.createSequence({
        accountId: 1,
        name: "Regular Follow-up",
        createdById: 10,
      });

      const regularSeq = await db.getSequenceById(regularId, 1);
      const isRegularTemplate = regularSeq!.name.includes("[TEMPLATE]");
      expect(isRegularTemplate).toBe(false);
    });

    it("clones a template sequence and preserves template name", async () => {
      const { id: origId } = await db.createSequence({
        accountId: 1,
        name: "[TEMPLATE] PMR Webinar Invite",
        createdById: 10,
      });

      await db.createSequenceStep({
        sequenceId: origId,
        position: 1,
        delayDays: 0,
        delayHours: 0,
        messageType: "email",
        subject: "Webinar on [WEBINAR DATE]",
        content: "Join us at [WEBINAR TIME]: [WEBINAR LINK]",
        templateId: null,
      });

      const seq = await db.getSequenceById(origId, 1);
      const newName = `Copy of ${seq!.name}`;
      const { id: cloneId } = await db.createSequence({
        accountId: 1,
        name: newName,
        description: seq!.description || null,
        createdById: 10,
      });

      const steps = await db.listSequenceSteps(origId);
      for (const step of steps) {
        await db.createSequenceStep({
          sequenceId: cloneId,
          position: step.position,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          messageType: step.messageType,
          subject: step.subject || null,
          content: step.content,
          templateId: step.templateId || null,
        });
      }

      const clonedSeq = await db.getSequenceById(cloneId, 1);
      expect(clonedSeq!.name).toBe("Copy of [TEMPLATE] PMR Webinar Invite");
      // The clone still contains [TEMPLATE] in the name
      expect(clonedSeq!.name.includes("[TEMPLATE]")).toBe(true);

      // Steps should still have placeholders
      const clonedSteps = await db.listSequenceSteps(cloneId);
      expect(clonedSteps[0].content).toContain("[WEBINAR TIME]");
      expect(clonedSteps[0].content).toContain("[WEBINAR LINK]");
    });

    it("cloned sequence is independent from original", async () => {
      const { id: origId } = await db.createSequence({
        accountId: 1,
        name: "Original",
        createdById: 10,
      });

      await db.createSequenceStep({
        sequenceId: origId,
        position: 1,
        delayDays: 0,
        delayHours: 0,
        messageType: "email",
        subject: "Test",
        content: "Original content",
        templateId: null,
      });

      // Clone
      const { id: cloneId } = await db.createSequence({
        accountId: 1,
        name: "Copy of Original",
        createdById: 10,
      });

      const steps = await db.listSequenceSteps(origId);
      for (const step of steps) {
        await db.createSequenceStep({
          sequenceId: cloneId,
          position: step.position,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          messageType: step.messageType,
          subject: step.subject || null,
          content: step.content,
          templateId: step.templateId || null,
        });
      }

      // Modify the clone
      const clonedSteps = await db.listSequenceSteps(cloneId);
      await db.updateSequenceStep(clonedSteps[0].id, cloneId, { content: "Modified clone content" });

      // Original should be unchanged
      const origSteps = await db.listSequenceSteps(origId);
      expect(origSteps[0].content).toBe("Original content");

      const updatedCloneSteps = await db.listSequenceSteps(cloneId);
      expect(updatedCloneSteps[0].content).toBe("Modified clone content");
    });
  });

  // ─── Feature 2: getStats structure ───
  describe("getStats data structure", () => {
    it("computes status breakdown correctly", () => {
      // Simulate the statusBreakdown computation
      const statusBreakdown = {
        active: 0,
        completed: 0,
        paused: 0,
        failed: 0,
        unenrolled: 0,
      };

      const statusRows = [
        { status: "active", cnt: 15 },
        { status: "completed", cnt: 8 },
        { status: "paused", cnt: 3 },
        { status: "failed", cnt: 1 },
        { status: "unenrolled", cnt: 5 },
      ];

      let total = 0;
      for (const row of statusRows) {
        (statusBreakdown as any)[row.status] = row.cnt;
        total += row.cnt;
      }

      expect(statusBreakdown.active).toBe(15);
      expect(statusBreakdown.completed).toBe(8);
      expect(statusBreakdown.paused).toBe(3);
      expect(statusBreakdown.failed).toBe(1);
      expect(statusBreakdown.unenrolled).toBe(5);
      expect(total).toBe(32);
    });

    it("computes completion rate excluding unenrolled", () => {
      const total = 32;
      const completed = 8;
      const unenrolled = 5;

      const denominator = total - unenrolled;
      const completionRate = denominator > 0
        ? Math.round((completed / denominator) * 1000) / 10
        : 0;

      // 8 / 27 * 100 = 29.6%
      expect(completionRate).toBe(29.6);
    });

    it("handles zero enrollments gracefully", () => {
      const total = 0;
      const completed = 0;
      const unenrolled = 0;

      const denominator = total - unenrolled;
      const completionRate = denominator > 0
        ? Math.round((completed / denominator) * 1000) / 10
        : 0;

      expect(completionRate).toBe(0);
    });

    it("computes average completion time in days", () => {
      const avgCompletionHours = 100.8;
      const avgDays = (avgCompletionHours / 24).toFixed(1);
      expect(avgDays).toBe("4.2");
    });

    it("handles null average completion hours", () => {
      const avgCompletionHours: number | null = null;
      const avgDays = avgCompletionHours != null ? (avgCompletionHours / 24).toFixed(1) : "N/A";
      expect(avgDays).toBe("N/A");
    });

    it("source breakdown defaults to zero", () => {
      const sourceBreakdown: Record<string, number> = {
        manual: 0,
        workflow: 0,
        campaign: 0,
        api: 0,
      };

      const sourceRows = [
        { source: "manual", cnt: 20 },
        { source: "workflow", cnt: 12 },
      ];

      for (const row of sourceRows) {
        if (row.source) sourceBreakdown[row.source] = row.cnt;
      }

      expect(sourceBreakdown.manual).toBe(20);
      expect(sourceBreakdown.workflow).toBe(12);
      expect(sourceBreakdown.campaign).toBe(0);
      expect(sourceBreakdown.api).toBe(0);
    });
  });

  // ─── Template detection ───
  describe("Template detection", () => {
    it("identifies [TEMPLATE] in sequence names", () => {
      const names = [
        "[TEMPLATE] PMR Webinar Invite Sequence",
        "[TEMPLATE] Agent Outreach",
        "Regular Follow-up",
        "Post-Application Drip",
        "Copy of [TEMPLATE] Webinar",
      ];

      const templateNames = names.filter((n) => n.includes("[TEMPLATE]"));
      expect(templateNames).toHaveLength(3);
      expect(templateNames).toContain("[TEMPLATE] PMR Webinar Invite Sequence");
      expect(templateNames).toContain("[TEMPLATE] Agent Outreach");
      expect(templateNames).toContain("Copy of [TEMPLATE] Webinar");
    });
  });
});

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { requireAccountMember } from "./contacts";
import {
  createSequence,
  listSequences,
  getSequenceById,
  updateSequence,
  deleteSequence,
  listSequenceSteps,
  createSequenceStep,
  updateSequenceStep,
  deleteSequenceStep,
  reorderSequenceSteps,
  enrollContactInSequence,
  unenrollContact,
  listSequenceEnrollments,
  getContactEnrollments,
} from "../db";
import { computeFirstStepAt } from "../services/dripEngine";
import { logContactActivity } from "../db";

export const sequencesRouter = router({
  /** List all sequences for an account */
  list: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listSequences(input.accountId);
    }),

  /** Get a single sequence with its steps */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const seq = await getSequenceById(input.id, input.accountId);
      if (!seq) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
      const steps = await listSequenceSteps(input.id);
      return { ...seq, steps };
    }),

  /** Create a new sequence */
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const { id } = await createSequence({
        accountId: input.accountId,
        name: input.name,
        description: input.description || null,
        createdById: ctx.user.id,
      });
      return { id };
    }),

  /** Update sequence name, description, or status */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        status: z.enum(["active", "paused", "draft", "archived"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;
      if (input.status !== undefined) data.status = input.status;
      await updateSequence(input.id, input.accountId, data as any);
      return { success: true };
    }),

  /** Delete a sequence and all its steps/enrollments */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), accountId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await deleteSequence(input.id, input.accountId);
      return { success: true };
    }),

  // ─── Steps ───

  /** Add a step to a sequence */
  addStep: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        position: z.number().int().positive(),
        delayDays: z.number().int().min(0).default(0),
        delayHours: z.number().int().min(0).max(23).default(0),
        messageType: z.enum(["sms", "email"]),
        subject: z.string().max(500).optional(),
        content: z.string().min(1),
        templateId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const seq = await getSequenceById(input.sequenceId, input.accountId);
      if (!seq) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
      const { id } = await createSequenceStep({
        sequenceId: input.sequenceId,
        position: input.position,
        delayDays: input.delayDays,
        delayHours: input.delayHours,
        messageType: input.messageType,
        subject: input.subject || null,
        content: input.content,
        templateId: input.templateId || null,
      });
      return { id };
    }),

  /** Update a step */
  updateStep: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        delayDays: z.number().int().min(0).optional(),
        delayHours: z.number().int().min(0).max(23).optional(),
        messageType: z.enum(["sms", "email"]).optional(),
        subject: z.string().max(500).optional(),
        content: z.string().min(1).optional(),
        templateId: z.number().int().positive().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const data: Record<string, unknown> = {};
      if (input.delayDays !== undefined) data.delayDays = input.delayDays;
      if (input.delayHours !== undefined) data.delayHours = input.delayHours;
      if (input.messageType !== undefined) data.messageType = input.messageType;
      if (input.subject !== undefined) data.subject = input.subject;
      if (input.content !== undefined) data.content = input.content;
      if (input.templateId !== undefined) data.templateId = input.templateId;
      await updateSequenceStep(input.id, input.sequenceId, data as any);
      return { success: true };
    }),

  /** Delete a step (auto-reorders remaining) */
  deleteStep: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await deleteSequenceStep(input.id, input.sequenceId);
      return { success: true };
    }),

  /** Reorder steps */
  reorderSteps: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        stepIds: z.array(z.number().int().positive()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await reorderSequenceSteps(input.sequenceId, input.stepIds);
      return { success: true };
    }),

  // ─── Enrollments ───

  /** Enroll a contact in a sequence */
  enroll: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        source: z.enum(["manual", "workflow", "campaign", "api"]).default("manual"),
        sourceId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const seq = await getSequenceById(input.sequenceId, input.accountId);
      if (!seq) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
      if (seq.status !== "active" && seq.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sequence is not active" });
      }
      // Get first step to compute delay
      const steps = await listSequenceSteps(input.sequenceId);
      const firstStep = steps[0];
      const nextStepAt = firstStep
        ? computeFirstStepAt(firstStep.delayDays, firstStep.delayHours)
        : new Date(Date.now() + 60000);

      const { id, alreadyEnrolled } = await enrollContactInSequence({
        sequenceId: input.sequenceId,
        contactId: input.contactId,
        accountId: input.accountId,
        currentStep: 0,
        status: "active",
        nextStepAt,
        enrollmentSource: input.source,
        sourceId: input.sourceId || null,
      });

      if (!alreadyEnrolled) {
        await logContactActivity({
          contactId: input.contactId,
          accountId: input.accountId,
          activityType: "automation_triggered",
          description: `Enrolled in sequence "${seq.name}"`,
          metadata: JSON.stringify({
            sequenceId: seq.id,
            sequenceName: seq.name,
            source: input.source,
          }),
        });
      }

      return { id, alreadyEnrolled };
    }),

  /** Bulk enroll multiple contacts */
  bulkEnroll: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        contactIds: z.array(z.number().int().positive()),
        accountId: z.number().int().positive(),
        source: z.enum(["manual", "workflow", "campaign", "api"]).default("manual"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const seq = await getSequenceById(input.sequenceId, input.accountId);
      if (!seq) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });

      const steps = await listSequenceSteps(input.sequenceId);
      const firstStep = steps[0];
      const nextStepAt = firstStep
        ? computeFirstStepAt(firstStep.delayDays, firstStep.delayHours)
        : new Date(Date.now() + 60000);

      let enrolled = 0;
      let skipped = 0;
      for (const contactId of input.contactIds) {
        const { alreadyEnrolled } = await enrollContactInSequence({
          sequenceId: input.sequenceId,
          contactId,
          accountId: input.accountId,
          currentStep: 0,
          status: "active",
          nextStepAt,
          enrollmentSource: input.source,
        });
        if (alreadyEnrolled) {
          skipped++;
        } else {
          enrolled++;
        }
      }
      return { enrolled, skipped };
    }),

  /** Unenroll a contact */
  unenroll: protectedProcedure
    .input(
      z.object({
        enrollmentId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await unenrollContact(input.enrollmentId, input.accountId);
      return { success: true };
    }),

  /** List enrollments for a sequence */
  listEnrollments: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        status: z.enum(["active", "completed", "paused", "failed", "unenrolled"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listSequenceEnrollments(input.sequenceId, input.accountId, input.status);
    }),

  /** Get enrollments for a specific contact */
  contactEnrollments: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return getContactEnrollments(input.contactId, input.accountId);
    }),
});

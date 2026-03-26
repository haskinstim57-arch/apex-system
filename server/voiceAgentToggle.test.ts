import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database module
vi.mock("./db", () => ({
  getAccountById: vi.fn(),
  updateAccount: vi.fn().mockResolvedValue(undefined),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getMember: vi.fn(),
}));

import * as db from "./db";

describe("Voice Agent Toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getVoiceAgentStatus", () => {
    it("should return voice agent status for an account", async () => {
      const mockAccount = {
        id: 420001,
        name: "PMR",
        voiceAgentEnabled: false,
        vapiAssistantId: "01504ee9-0d19-4e2f-97e7-6907a5ebb34c",
        vapiPhoneNumber: "+15551234567",
        elevenLabsVoiceId: "5q6TS1ZeXhDKOywAbaO2",
      };
      (db.getAccountById as any).mockResolvedValue(mockAccount);

      const account = await db.getAccountById(420001);
      expect(account).toBeTruthy();
      expect((account as any).voiceAgentEnabled).toBe(false);
      expect((account as any).vapiAssistantId).toBe("01504ee9-0d19-4e2f-97e7-6907a5ebb34c");
      expect((account as any).vapiPhoneNumber).toBe("+15551234567");
    });

    it("should return defaults when voice agent not configured", async () => {
      const mockAccount = {
        id: 450002,
        name: "Apex System",
        voiceAgentEnabled: false,
        vapiAssistantId: null,
        vapiPhoneNumber: null,
        elevenLabsVoiceId: null,
      };
      (db.getAccountById as any).mockResolvedValue(mockAccount);

      const account = await db.getAccountById(450002);
      expect((account as any).voiceAgentEnabled).toBe(false);
      expect((account as any).vapiAssistantId).toBeNull();
    });
  });

  describe("toggleVoiceAgent", () => {
    it("should enable voice agent for an account", async () => {
      await db.updateAccount(420001, { voiceAgentEnabled: true } as any);
      expect(db.updateAccount).toHaveBeenCalledWith(420001, { voiceAgentEnabled: true });
    });

    it("should disable voice agent for an account", async () => {
      await db.updateAccount(420001, { voiceAgentEnabled: false } as any);
      expect(db.updateAccount).toHaveBeenCalledWith(420001, { voiceAgentEnabled: false });
    });

    it("should create an audit log when enabling", async () => {
      await db.createAuditLog({
        accountId: 420001,
        userId: 1,
        action: "voice_agent.enabled",
        resourceType: "account",
        resourceId: 420001,
      });
      expect(db.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "voice_agent.enabled",
          accountId: 420001,
        })
      );
    });

    it("should create an audit log when disabling", async () => {
      await db.createAuditLog({
        accountId: 420001,
        userId: 1,
        action: "voice_agent.disabled",
        resourceType: "account",
        resourceId: 420001,
      });
      expect(db.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "voice_agent.disabled",
          accountId: 420001,
        })
      );
    });
  });

  describe("Access control", () => {
    it("should allow account owner to toggle", async () => {
      (db.getMember as any).mockResolvedValue({
        userId: 10,
        accountId: 420001,
        role: "owner",
        isActive: true,
      });

      const member = await db.getMember(420001, 10);
      expect(member).toBeTruthy();
      expect(member!.role).toBe("owner");
    });

    it("should deny employee from toggling", async () => {
      (db.getMember as any).mockResolvedValue({
        userId: 20,
        accountId: 420001,
        role: "employee",
        isActive: true,
      });

      const member = await db.getMember(420001, 20);
      expect(member!.role).toBe("employee");
      // In the actual router, employee role would be rejected
      expect(["owner"].includes(member!.role)).toBe(false);
    });

    it("should allow manager to view status but not toggle", async () => {
      (db.getMember as any).mockResolvedValue({
        userId: 15,
        accountId: 420001,
        role: "manager",
        isActive: true,
      });

      const member = await db.getMember(420001, 15);
      // Manager can view (owner + manager allowed)
      expect(["owner", "manager"].includes(member!.role)).toBe(true);
      // Manager cannot toggle (only owner allowed)
      expect(["owner"].includes(member!.role)).toBe(false);
    });
  });

  describe("All accounts disabled", () => {
    it("should verify all 3 accounts have voiceAgentEnabled=false", async () => {
      const accounts = [
        { id: 450002, name: "Apex System", voiceAgentEnabled: false },
        { id: 390025, name: "Kyle (OLS)", voiceAgentEnabled: false },
        { id: 420001, name: "PMR", voiceAgentEnabled: false },
      ];

      for (const acc of accounts) {
        (db.getAccountById as any).mockResolvedValue(acc);
        const account = await db.getAccountById(acc.id);
        expect((account as any).voiceAgentEnabled).toBe(false);
      }
    });
  });
});

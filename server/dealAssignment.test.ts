import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers ───
const mockGetDealById = vi.fn();
const mockUpdateDeal = vi.fn().mockResolvedValue(undefined);
const mockGetMember = vi.fn();
const mockListMembers = vi.fn();
const mockCreateDeal = vi.fn().mockResolvedValue({ id: 100 });
const mockGetPipelineById = vi.fn();
const mockGetPipelineStageById = vi.fn();
const mockGetContactById = vi.fn();
const mockGetDealByContactId = vi.fn();
const mockLogContactActivity = vi.fn();

vi.mock("./db", () => ({
  getDealById: (...args: any[]) => mockGetDealById(...args),
  updateDeal: (...args: any[]) => mockUpdateDeal(...args),
  getMember: (...args: any[]) => mockGetMember(...args),
  listMembers: (...args: any[]) => mockListMembers(...args),
  createDeal: (...args: any[]) => mockCreateDeal(...args),
  getPipelineById: (...args: any[]) => mockGetPipelineById(...args),
  getPipelineStageById: (...args: any[]) => mockGetPipelineStageById(...args),
  getContactById: (...args: any[]) => mockGetContactById(...args),
  getDealByContactId: (...args: any[]) => mockGetDealByContactId(...args),
  logContactActivity: (...args: any[]) => mockLogContactActivity(...args),
  listPipelines: vi.fn().mockResolvedValue([]),
  getOrCreateDefaultPipeline: vi.fn(),
  listPipelineStages: vi.fn().mockResolvedValue([]),
  listDeals: vi.fn().mockResolvedValue([]),
  deleteDeal: vi.fn(),
  updatePipelineStage: vi.fn(),
  insertPipelineStage: vi.fn(),
  deletePipelineStage: vi.fn(),
  countDealsByStage: vi.fn(),
  getMaxStageSortOrder: vi.fn(),
}));

// ─── Mock workflowTriggers + sequenceAutoStop (used by moveDeal) ───
vi.mock("./services/workflowTriggers", () => ({
  onPipelineStageChanged: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./services/sequenceAutoStop", () => ({
  onPipelineStageChangedAutoStop: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import the router after mocks ───
import { pipelineRouter } from "./routers/pipeline";

// Helper to create a caller with a given user context
function createCaller(userId: number, role: string = "user") {
  return pipelineRouter.createCaller({
    user: { id: userId, role, name: "Test User", email: "test@test.com", openId: "oid" },
    req: {} as any,
    res: {} as any,
  } as any);
}

describe("Deal Assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── assignDeal mutation ───
  describe("assignDeal mutation", () => {
    it("assigns a deal to a team member and persists", async () => {
      // User is admin
      mockGetMember.mockResolvedValue({ userId: 1, accountId: 10, role: "owner", isActive: true });
      mockGetDealById.mockResolvedValue({ id: 50, accountId: 10, stageId: 1, pipelineId: 1, contactId: 5 });
      // Target member is active
      mockGetMember.mockResolvedValueOnce({ userId: 1, accountId: 10, role: "owner", isActive: true })
                    .mockResolvedValueOnce({ userId: 7, accountId: 10, role: "employee", isActive: true });

      const caller = createCaller(1, "admin");
      const result = await caller.assignDeal({ dealId: 50, accountId: 10, assignedUserId: 7 });

      expect(result.success).toBe(true);
      expect(mockUpdateDeal).toHaveBeenCalledWith(50, 10, { assignedUserId: 7 });
    });

    it("unassigns a deal (set to null)", async () => {
      mockGetMember.mockResolvedValue({ userId: 1, accountId: 10, role: "owner", isActive: true });
      mockGetDealById.mockResolvedValue({ id: 50, accountId: 10, stageId: 1, pipelineId: 1, contactId: 5 });

      const caller = createCaller(1, "admin");
      const result = await caller.assignDeal({ dealId: 50, accountId: 10, assignedUserId: null });

      expect(result.success).toBe(true);
      expect(mockUpdateDeal).toHaveBeenCalledWith(50, 10, { assignedUserId: null });
    });

    it("employees can assign deals to themselves", async () => {
      mockGetMember.mockResolvedValueOnce({ userId: 5, accountId: 10, role: "employee", isActive: true })
                    .mockResolvedValueOnce({ userId: 5, accountId: 10, role: "employee", isActive: true });
      mockGetDealById.mockResolvedValue({ id: 50, accountId: 10, stageId: 1, pipelineId: 1, contactId: 5 });

      const caller = createCaller(5);
      const result = await caller.assignDeal({ dealId: 50, accountId: 10, assignedUserId: 5 });

      expect(result.success).toBe(true);
      expect(mockUpdateDeal).toHaveBeenCalledWith(50, 10, { assignedUserId: 5 });
    });

    it("employees CANNOT assign deals to other users", async () => {
      mockGetMember.mockResolvedValue({ userId: 5, accountId: 10, role: "employee", isActive: true });
      mockGetDealById.mockResolvedValue({ id: 50, accountId: 10, stageId: 1, pipelineId: 1, contactId: 5 });

      const caller = createCaller(5);
      await expect(
        caller.assignDeal({ dealId: 50, accountId: 10, assignedUserId: 7 })
      ).rejects.toThrow("Employees can only assign deals to themselves");

      expect(mockUpdateDeal).not.toHaveBeenCalled();
    });

    it("rejects assignment to inactive member", async () => {
      mockGetMember.mockResolvedValueOnce({ userId: 1, accountId: 10, role: "owner", isActive: true })
                    .mockResolvedValueOnce({ userId: 7, accountId: 10, role: "employee", isActive: false });
      mockGetDealById.mockResolvedValue({ id: 50, accountId: 10, stageId: 1, pipelineId: 1, contactId: 5 });

      const caller = createCaller(1, "admin");
      await expect(
        caller.assignDeal({ dealId: 50, accountId: 10, assignedUserId: 7 })
      ).rejects.toThrow("Target user is not an active member");

      expect(mockUpdateDeal).not.toHaveBeenCalled();
    });

    it("rejects assignment for non-existent deal", async () => {
      mockGetMember.mockResolvedValue({ userId: 1, accountId: 10, role: "owner", isActive: true });
      mockGetDealById.mockResolvedValue(null);

      const caller = createCaller(1, "admin");
      await expect(
        caller.assignDeal({ dealId: 999, accountId: 10, assignedUserId: 7 })
      ).rejects.toThrow("Deal not found");
    });
  });

  // ─── createDeal default assignment ───
  describe("createDeal default assignment logic", () => {
    const basePipeline = { id: 1, name: "Default", accountId: 10 };
    const baseStage = { id: 1, pipelineId: 1, name: "New Lead", color: "#000" };
    const baseContact = {
      id: 5, firstName: "Jane", lastName: "Doe", email: "jane@test.com",
      phone: null, status: null, leadSource: null, company: null,
      assignedUserId: null,
    };

    beforeEach(() => {
      mockGetMember.mockResolvedValue({ userId: 1, accountId: 10, role: "owner", isActive: true });
      mockGetPipelineById.mockResolvedValue(basePipeline);
      mockGetPipelineStageById.mockResolvedValue(baseStage);
      mockGetContactById.mockResolvedValue(baseContact);
      mockGetDealByContactId.mockResolvedValue(null);
      mockCreateDeal.mockResolvedValue({ id: 100 });
    });

    it("defaults to current user when created manually (no explicit assignedUserId)", async () => {
      const caller = createCaller(1, "admin");
      await caller.createDeal({
        accountId: 10,
        pipelineId: 1,
        stageId: 1,
        contactId: 5,
      });

      expect(mockCreateDeal).toHaveBeenCalledWith(
        expect.objectContaining({ assignedUserId: 1 })
      );
    });

    it("uses contact's assignedUserId when available (automation path)", async () => {
      mockGetContactById.mockResolvedValue({
        ...baseContact,
        assignedUserId: 42,
      });

      const caller = createCaller(1, "admin");
      await caller.createDeal({
        accountId: 10,
        pipelineId: 1,
        stageId: 1,
        contactId: 5,
      });

      expect(mockCreateDeal).toHaveBeenCalledWith(
        expect.objectContaining({ assignedUserId: 42 })
      );
    });

    it("uses explicit assignedUserId when provided", async () => {
      const caller = createCaller(1, "admin");
      await caller.createDeal({
        accountId: 10,
        pipelineId: 1,
        stageId: 1,
        contactId: 5,
        assignedUserId: 99,
      });

      expect(mockCreateDeal).toHaveBeenCalledWith(
        expect.objectContaining({ assignedUserId: 99 })
      );
    });
  });

  // ─── listTeamMembers ───
  describe("listTeamMembers", () => {
    it("returns only active members with name, email, role", async () => {
      mockGetMember.mockResolvedValue({ userId: 1, accountId: 10, role: "owner", isActive: true });
      mockListMembers.mockResolvedValue([
        { userId: 1, userName: "Alice", userEmail: "alice@test.com", role: "owner", isActive: true },
        { userId: 2, userName: "Bob", userEmail: "bob@test.com", role: "employee", isActive: true },
        { userId: 3, userName: "Charlie", userEmail: "charlie@test.com", role: "employee", isActive: false },
      ]);

      const caller = createCaller(1, "admin");
      const result = await caller.listTeamMembers({ accountId: 10 });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ userId: 1, name: "Alice", email: "alice@test.com", role: "owner" });
      expect(result[1]).toEqual({ userId: 2, name: "Bob", email: "bob@test.com", role: "employee" });
    });
  });
});

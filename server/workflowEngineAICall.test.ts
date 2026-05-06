import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockGetAccountById = vi.fn();
const mockGetAccountMessagingSettings = vi.fn();
const mockGetContactById = vi.fn();
const mockCreateAICall = vi.fn();
const mockUpdateAICall = vi.fn();
const mockEnqueueMessage = vi.fn();
const mockCreateVapiCall = vi.fn();
const mockResolveAssistantId = vi.fn();
const mockIsWithinAccountBusinessHours = vi.fn();

vi.mock("../server/db", () => ({
  getContactById: (...args: any[]) => mockGetContactById(...args),
  getAccountById: (...args: any[]) => mockGetAccountById(...args),
  getAccountMessagingSettings: (...args: any[]) => mockGetAccountMessagingSettings(...args),
  createAICall: (...args: any[]) => mockCreateAICall(...args),
  updateAICall: (...args: any[]) => mockUpdateAICall(...args),
  getAccountOwnerUserId: vi.fn().mockResolvedValue(1),
  createNotification: vi.fn().mockResolvedValue({}),
}));

vi.mock("../server/services/vapi", () => ({
  createVapiCall: (...args: any[]) => mockCreateVapiCall(...args),
  resolveAssistantId: (...args: any[]) => mockResolveAssistantId(...args),
}));

vi.mock("../server/utils/businessHours", () => ({
  isWithinAccountBusinessHours: (...args: any[]) => mockIsWithinAccountBusinessHours(...args),
  isWithinBusinessHours: vi.fn().mockReturnValue(true),
  isWithinBusinessHoursSchedule: vi.fn().mockReturnValue(true),
}));

vi.mock("../server/services/messageQueue", () => ({
  enqueueMessage: (...args: any[]) => mockEnqueueMessage(...args),
}));

import { executeAction } from "./services/workflowEngine";

function makeStep(config: Record<string, unknown> = {}) {
  return {
    id: 1,
    workflowId: 100,
    actionType: "start_ai_call",
    config: JSON.stringify(config),
    delayMinutes: 0,
    stepOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

describe("Workflow Engine — start_ai_call per-account BH + VAPI creds", () => {
  const PMR_ACCOUNT_ID = 420001;
  const CONTACT_ID = 100;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAccountById.mockResolvedValue({
      id: PMR_ACCOUNT_ID,
      name: "PMR Account",
      voiceAgentEnabled: true,
      vapiAssistantId: null,
    });

    mockGetAccountMessagingSettings.mockResolvedValue({
      vapiApiKey: "pmr-vapi-key-123",
      vapiPhoneNumberId: "pmr-phone-id-456",
      vapiAssistantIdOverride: "pmr-assistant-override-789",
    });

    mockGetContactById.mockResolvedValue({
      id: CONTACT_ID,
      firstName: "John",
      lastName: "Doe",
      phone: "+15551234567",
      email: "john@example.com",
      leadSource: "facebook",
      status: "new",
    });

    mockIsWithinAccountBusinessHours.mockResolvedValue(true);
    mockCreateVapiCall.mockResolvedValue({ id: "vapi-call-ext-id" });
    mockCreateAICall.mockResolvedValue({ id: 999 });
    mockUpdateAICall.mockResolvedValue({});
    mockResolveAssistantId.mockReturnValue("global-fallback-assistant");
    mockEnqueueMessage.mockResolvedValue({ id: 5001 });
  });

  it("should call createVapiCall with per-account apiKey and phoneNumberId when within business hours", async () => {
    const result = await executeAction(makeStep(), CONTACT_ID, PMR_ACCOUNT_ID);

    // Verify isWithinAccountBusinessHours was called with accountId
    expect(mockIsWithinAccountBusinessHours).toHaveBeenCalledWith(PMR_ACCOUNT_ID);

    // Verify createVapiCall received per-account creds
    expect(mockCreateVapiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: "+15551234567",
        customerName: "John Doe",
        assistantId: "pmr-assistant-override-789",
        apiKey: "pmr-vapi-key-123",
        phoneNumberId: "pmr-phone-id-456",
      })
    );

    expect(mockEnqueueMessage).not.toHaveBeenCalled();
    expect(result).toHaveProperty("callId", 999);
    expect(result).toHaveProperty("status", "calling");
  });

  it("should queue the call when outside business hours (using per-account BH)", async () => {
    mockIsWithinAccountBusinessHours.mockResolvedValue(false);

    const result = await executeAction(makeStep(), CONTACT_ID, PMR_ACCOUNT_ID);

    expect(mockCreateVapiCall).not.toHaveBeenCalled();
    expect(mockEnqueueMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: PMR_ACCOUNT_ID,
        contactId: CONTACT_ID,
        type: "ai_call",
      })
    );
    expect(result).toHaveProperty("queued", true);
    expect(result).toHaveProperty("reason", "queued_outside_business_hours");
  });

  it("should use account assistantIdOverride over lead-source routing", async () => {
    await executeAction(makeStep(), CONTACT_ID, PMR_ACCOUNT_ID);

    expect(mockCreateVapiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        assistantId: "pmr-assistant-override-789",
      })
    );
    expect(mockResolveAssistantId).not.toHaveBeenCalled();
  });

  it("should fall back to lead-source routing when no account override exists", async () => {
    mockGetAccountMessagingSettings.mockResolvedValue({
      vapiApiKey: "pmr-key",
      vapiPhoneNumberId: "pmr-phone",
      vapiAssistantIdOverride: null,
    });
    mockGetAccountById.mockResolvedValue({
      id: PMR_ACCOUNT_ID,
      voiceAgentEnabled: true,
      vapiAssistantId: null,
    });

    await executeAction(makeStep(), CONTACT_ID, PMR_ACCOUNT_ID);

    expect(mockResolveAssistantId).toHaveBeenCalledWith("facebook");
    expect(mockCreateVapiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        assistantId: "global-fallback-assistant",
        apiKey: "pmr-key",
        phoneNumberId: "pmr-phone",
      })
    );
  });

  it("should skip BH check when skipBusinessHoursCheck is set in config", async () => {
    mockIsWithinAccountBusinessHours.mockResolvedValue(false);

    const result = await executeAction(
      makeStep({ skipBusinessHoursCheck: true }),
      CONTACT_ID,
      PMR_ACCOUNT_ID
    );

    expect(mockCreateVapiCall).toHaveBeenCalled();
    expect(mockEnqueueMessage).not.toHaveBeenCalled();
    expect(result).toHaveProperty("status", "calling");
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Test helpers ───

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

// ─── Trigger Wiring Tests ───

describe("trigger wiring - onContactCreated", () => {
  it("fires onContactCreated when a contact is created", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    if (accounts.length === 0) return;

    // Create a workflow that listens for contact_created
    const { id: workflowId } = await caller.automations.create({
      accountId: accounts[0].id,
      name: "Trigger Wire Test - Contact Created",
      triggerType: "contact_created",
    });

    await caller.automations.addStep({
      accountId: accounts[0].id,
      workflowId,
      stepType: "action",
      actionType: "add_tag",
      config: JSON.stringify({ tag: "auto-tagged" }),
    });

    // Activate the workflow
    await caller.automations.toggle({
      id: workflowId,
      accountId: accounts[0].id,
    });

    // Create a contact — this should fire the trigger
    const { id: contactId } = await caller.contacts.create({
      accountId: accounts[0].id,
      firstName: "Trigger",
      lastName: "TestContact",
      email: "trigger-test@example.com",
      phone: "+15551234567",
    });

    expect(contactId).toBeGreaterThan(0);

    // Give the async trigger time to fire and queue execution
    await new Promise((r) => setTimeout(r, 1000));

    // Check if an execution was created for this workflow
    const executions = await caller.automations.listExecutions({
      accountId: accounts[0].id,
      workflowId,
    });

    expect(executions.executions.length).toBeGreaterThanOrEqual(1);
    // The most recent execution should be for our contact
    const latestExec = executions.executions[0];
    expect(latestExec.contactId).toBe(contactId);
    expect(latestExec.triggeredBy).toBe("contact_created");

    // Cleanup
    await caller.automations.delete({ id: workflowId, accountId: accounts[0].id });
    await caller.contacts.delete({ id: contactId, accountId: accounts[0].id });
  });

  it("fires onFacebookLeadReceived when contact has facebook lead source", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    if (accounts.length === 0) return;

    // Create a workflow that listens for facebook_lead_received
    const { id: workflowId } = await caller.automations.create({
      accountId: accounts[0].id,
      name: "Trigger Wire Test - Facebook Lead",
      triggerType: "facebook_lead_received",
    });

    await caller.automations.addStep({
      accountId: accounts[0].id,
      workflowId,
      stepType: "action",
      actionType: "add_tag",
      config: JSON.stringify({ tag: "fb-lead" }),
    });

    await caller.automations.toggle({
      id: workflowId,
      accountId: accounts[0].id,
    });

    // Create a contact with Facebook lead source
    const { id: contactId } = await caller.contacts.create({
      accountId: accounts[0].id,
      firstName: "Facebook",
      lastName: "Lead",
      email: "fb-lead@example.com",
      phone: "+15559876543",
      leadSource: "Facebook Ads",
    });

    expect(contactId).toBeGreaterThan(0);

    // Give the async trigger time to fire
    await new Promise((r) => setTimeout(r, 1000));

    // Check if an execution was created
    const executions = await caller.automations.listExecutions({
      accountId: accounts[0].id,
      workflowId,
    });

    expect(executions.executions.length).toBeGreaterThanOrEqual(1);
    const latestExec = executions.executions[0];
    expect(latestExec.contactId).toBe(contactId);
    expect(latestExec.triggeredBy).toBe("facebook_lead_received");

    // Cleanup
    await caller.automations.delete({ id: workflowId, accountId: accounts[0].id });
    await caller.contacts.delete({ id: contactId, accountId: accounts[0].id });
  });

  it("does NOT fire facebook trigger for non-facebook leads", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    if (accounts.length === 0) return;

    // Create a workflow that listens for facebook_lead_received
    const { id: workflowId } = await caller.automations.create({
      accountId: accounts[0].id,
      name: "Trigger Wire Test - No Facebook",
      triggerType: "facebook_lead_received",
    });

    await caller.automations.addStep({
      accountId: accounts[0].id,
      workflowId,
      stepType: "action",
      actionType: "add_tag",
      config: JSON.stringify({ tag: "fb-lead" }),
    });

    await caller.automations.toggle({
      id: workflowId,
      accountId: accounts[0].id,
    });

    // Create a contact with non-Facebook lead source
    const { id: contactId } = await caller.contacts.create({
      accountId: accounts[0].id,
      firstName: "Organic",
      lastName: "Lead",
      email: "organic@example.com",
      phone: "+15551112222",
      leadSource: "Referral",
    });

    await new Promise((r) => setTimeout(r, 500));

    // Should NOT have an execution for this contact
    const executions = await caller.automations.listExecutions({
      accountId: accounts[0].id,
      workflowId,
    });

    const matchingExecs = executions.executions.filter((e) => e.contactId === contactId);
    expect(matchingExecs.length).toBe(0);

    // Cleanup
    await caller.automations.delete({ id: workflowId, accountId: accounts[0].id });
    await caller.contacts.delete({ id: contactId, accountId: accounts[0].id });
  });
});

describe("trigger wiring - onTagAdded", () => {
  it("fires onTagAdded when a tag is added to a contact", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    if (accounts.length === 0) return;

    // Create a workflow that listens for tag_added with specific tag
    const { id: workflowId } = await caller.automations.create({
      accountId: accounts[0].id,
      name: "Trigger Wire Test - Tag Added",
      triggerType: "tag_added",
      triggerConfig: JSON.stringify({ tag: "hot-lead" }),
    });

    await caller.automations.addStep({
      accountId: accounts[0].id,
      workflowId,
      stepType: "action",
      actionType: "create_task",
      config: JSON.stringify({ title: "Follow up with hot lead", priority: "high" }),
    });

    await caller.automations.toggle({
      id: workflowId,
      accountId: accounts[0].id,
    });

    // Create a contact first
    const { id: contactId } = await caller.contacts.create({
      accountId: accounts[0].id,
      firstName: "Tag",
      lastName: "TestContact",
      email: "tag-test@example.com",
    });

    // Add the matching tag
    await caller.contacts.addTag({
      contactId,
      accountId: accounts[0].id,
      tag: "hot-lead",
    });

    // Give the async trigger time to fire
    await new Promise((r) => setTimeout(r, 1000));

    // Check if an execution was created
    const executions = await caller.automations.listExecutions({
      accountId: accounts[0].id,
      workflowId,
    });

    expect(executions.executions.length).toBeGreaterThanOrEqual(1);
    const latestExec = executions.executions[0];
    expect(latestExec.contactId).toBe(contactId);
    expect(latestExec.triggeredBy).toBe("tag_added:hot-lead");

    // Cleanup
    await caller.automations.delete({ id: workflowId, accountId: accounts[0].id });
    await caller.contacts.delete({ id: contactId, accountId: accounts[0].id });
  });

  it("does NOT fire tag trigger for non-matching tags", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    if (accounts.length === 0) return;

    // Create a workflow that listens for tag_added with specific tag
    const { id: workflowId } = await caller.automations.create({
      accountId: accounts[0].id,
      name: "Trigger Wire Test - Wrong Tag",
      triggerType: "tag_added",
      triggerConfig: JSON.stringify({ tag: "vip" }),
    });

    await caller.automations.addStep({
      accountId: accounts[0].id,
      workflowId,
      stepType: "action",
      actionType: "add_tag",
      config: JSON.stringify({ tag: "vip-processed" }),
    });

    await caller.automations.toggle({
      id: workflowId,
      accountId: accounts[0].id,
    });

    // Create a contact
    const { id: contactId } = await caller.contacts.create({
      accountId: accounts[0].id,
      firstName: "Wrong",
      lastName: "Tag",
      email: "wrong-tag@example.com",
    });

    // Add a different tag
    await caller.contacts.addTag({
      contactId,
      accountId: accounts[0].id,
      tag: "cold-lead",
    });

    await new Promise((r) => setTimeout(r, 500));

    // Should NOT have an execution for this contact
    const executions = await caller.automations.listExecutions({
      accountId: accounts[0].id,
      workflowId,
    });

    const matchingExecs = executions.executions.filter((e) => e.contactId === contactId);
    expect(matchingExecs.length).toBe(0);

    // Cleanup
    await caller.automations.delete({ id: workflowId, accountId: accounts[0].id });
    await caller.contacts.delete({ id: contactId, accountId: accounts[0].id });
  });

  it("fires onTagAdded for tags added during contact creation", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    if (accounts.length === 0) return;

    // Create a workflow that listens for tag_added
    const { id: workflowId } = await caller.automations.create({
      accountId: accounts[0].id,
      name: "Trigger Wire Test - Create With Tags",
      triggerType: "tag_added",
      triggerConfig: JSON.stringify({ tag: "new-lead" }),
    });

    await caller.automations.addStep({
      accountId: accounts[0].id,
      workflowId,
      stepType: "action",
      actionType: "create_task",
      config: JSON.stringify({ title: "Process new lead" }),
    });

    await caller.automations.toggle({
      id: workflowId,
      accountId: accounts[0].id,
    });

    // Create a contact with tags included
    const { id: contactId } = await caller.contacts.create({
      accountId: accounts[0].id,
      firstName: "Tagged",
      lastName: "OnCreate",
      email: "tagged-create@example.com",
      tags: ["new-lead", "mortgage"],
    });

    // Give the async trigger time to fire
    await new Promise((r) => setTimeout(r, 1000));

    // Check if an execution was created
    const executions = await caller.automations.listExecutions({
      accountId: accounts[0].id,
      workflowId,
    });

    expect(executions.executions.length).toBeGreaterThanOrEqual(1);
    const latestExec = executions.executions[0];
    expect(latestExec.contactId).toBe(contactId);

    // Cleanup
    await caller.automations.delete({ id: workflowId, accountId: accounts[0].id });
    await caller.contacts.delete({ id: contactId, accountId: accounts[0].id });
  });
});

describe("trigger wiring - onPipelineStageChanged", () => {
  it("fires onPipelineStageChanged when contact status is updated", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    if (accounts.length === 0) return;

    // Create a workflow that listens for pipeline_stage_changed to "qualified"
    const { id: workflowId } = await caller.automations.create({
      accountId: accounts[0].id,
      name: "Trigger Wire Test - Pipeline Changed",
      triggerType: "pipeline_stage_changed",
      triggerConfig: JSON.stringify({ toStatus: "qualified" }),
    });

    await caller.automations.addStep({
      accountId: accounts[0].id,
      workflowId,
      stepType: "action",
      actionType: "create_task",
      config: JSON.stringify({ title: "Qualified lead - schedule call", priority: "high" }),
    });

    await caller.automations.toggle({
      id: workflowId,
      accountId: accounts[0].id,
    });

    // Create a contact with "new" status
    const { id: contactId } = await caller.contacts.create({
      accountId: accounts[0].id,
      firstName: "Pipeline",
      lastName: "TestContact",
      email: "pipeline-test@example.com",
      status: "new",
    });

    // Update the contact's status to "qualified"
    await caller.contacts.update({
      id: contactId,
      accountId: accounts[0].id,
      status: "qualified",
    });

    // Give the async trigger time to fire
    await new Promise((r) => setTimeout(r, 1000));

    // Check if an execution was created
    const executions = await caller.automations.listExecutions({
      accountId: accounts[0].id,
      workflowId,
    });

    expect(executions.executions.length).toBeGreaterThanOrEqual(1);
    const latestExec = executions.executions[0];
    expect(latestExec.contactId).toBe(contactId);
    expect(latestExec.triggeredBy).toContain("pipeline_stage_changed");

    // Cleanup
    await caller.automations.delete({ id: workflowId, accountId: accounts[0].id });
    await caller.contacts.delete({ id: contactId, accountId: accounts[0].id });
  });

  it("does NOT fire pipeline trigger when status doesn't match", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    if (accounts.length === 0) return;

    // Create a workflow that listens for pipeline_stage_changed to "won"
    const { id: workflowId } = await caller.automations.create({
      accountId: accounts[0].id,
      name: "Trigger Wire Test - Wrong Stage",
      triggerType: "pipeline_stage_changed",
      triggerConfig: JSON.stringify({ toStatus: "won" }),
    });

    await caller.automations.addStep({
      accountId: accounts[0].id,
      workflowId,
      stepType: "action",
      actionType: "add_tag",
      config: JSON.stringify({ tag: "winner" }),
    });

    await caller.automations.toggle({
      id: workflowId,
      accountId: accounts[0].id,
    });

    // Create a contact
    const { id: contactId } = await caller.contacts.create({
      accountId: accounts[0].id,
      firstName: "Wrong",
      lastName: "Stage",
      email: "wrong-stage@example.com",
      status: "new",
    });

    // Update to "contacted" (not "won")
    await caller.contacts.update({
      id: contactId,
      accountId: accounts[0].id,
      status: "contacted",
    });

    await new Promise((r) => setTimeout(r, 500));

    // Should NOT have an execution for this contact
    const executions = await caller.automations.listExecutions({
      accountId: accounts[0].id,
      workflowId,
    });

    const matchingExecs = executions.executions.filter((e) => e.contactId === contactId);
    expect(matchingExecs.length).toBe(0);

    // Cleanup
    await caller.automations.delete({ id: workflowId, accountId: accounts[0].id });
    await caller.contacts.delete({ id: contactId, accountId: accounts[0].id });
  });

  it("does NOT fire pipeline trigger when status is unchanged", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    if (accounts.length === 0) return;

    // Create a workflow
    const { id: workflowId } = await caller.automations.create({
      accountId: accounts[0].id,
      name: "Trigger Wire Test - No Change",
      triggerType: "pipeline_stage_changed",
    });

    await caller.automations.addStep({
      accountId: accounts[0].id,
      workflowId,
      stepType: "action",
      actionType: "add_tag",
      config: JSON.stringify({ tag: "changed" }),
    });

    await caller.automations.toggle({
      id: workflowId,
      accountId: accounts[0].id,
    });

    // Create a contact with "new" status
    const { id: contactId } = await caller.contacts.create({
      accountId: accounts[0].id,
      firstName: "NoChange",
      lastName: "Status",
      email: "no-change@example.com",
      status: "new",
    });

    // Update only the name, not the status
    await caller.contacts.update({
      id: contactId,
      accountId: accounts[0].id,
      firstName: "StillNoChange",
    });

    await new Promise((r) => setTimeout(r, 500));

    // Should NOT have an execution for this contact
    const executions = await caller.automations.listExecutions({
      accountId: accounts[0].id,
      workflowId,
    });

    const matchingExecs = executions.executions.filter((e) => e.contactId === contactId);
    expect(matchingExecs.length).toBe(0);

    // Cleanup
    await caller.automations.delete({ id: workflowId, accountId: accounts[0].id });
    await caller.contacts.delete({ id: contactId, accountId: accounts[0].id });
  });
});

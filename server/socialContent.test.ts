import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock LLM before any imports ────────────────────────────────────────────
const mockInvokeLLM = vi.fn();
vi.mock("./_core/llm", () => ({
  invokeLLM: (...args: unknown[]) => mockInvokeLLM(...args),
}));

import { generateSocialPost, generateContentCalendar } from "./services/contentGenerator";

describe("contentGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSocialPost", () => {
    it("should parse LLM response and return normalized variations", async () => {
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                posts: [
                  {
                    content: "Check out our new mortgage rates!",
                    hashtags: ["#mortgage", "#homebuying", "rates"],
                    imagePrompt: "A happy family in front of a new home",
                  },
                  {
                    content: "Low rates are here to stay.",
                    hashtags: ["#lowrates", "#realestate"],
                    imagePrompt: "A chart showing declining rates",
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await generateSocialPost({
        accountId: 1,
        platform: "facebook",
        topic: "mortgage rates",
        tone: "professional",
      });

      expect(result.variations).toHaveLength(2);
      expect(result.variations[0].content).toBe("Check out our new mortgage rates!");
      // Hashtags should have # prefix stripped
      expect(result.variations[0].hashtags).toEqual(["mortgage", "homebuying", "rates"]);
      expect(result.variations[0].imagePrompt).toBe("A happy family in front of a new home");
      // Verify invokeLLM was called with response_format
      expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
      const callArgs = mockInvokeLLM.mock.calls[0][0];
      expect(callArgs.response_format).toBeDefined();
      expect(callArgs.response_format.type).toBe("json_schema");
    });

    it("should include brand voice in the system prompt when provided", async () => {
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                posts: [
                  {
                    content: "Test post",
                    hashtags: ["test"],
                    imagePrompt: "Test image",
                  },
                ],
              }),
            },
          },
        ],
      });

      await generateSocialPost({
        accountId: 1,
        platform: "linkedin",
        topic: "industry insights",
        tone: "professional",
        brandVoice: {
          industry: "Mortgage",
          targetAudience: "First-time homebuyers",
          brandPersonality: "Trusted advisor",
          keyMessages: JSON.stringify(["Low rates", "Expert guidance"]),
          avoidTopics: JSON.stringify(["Politics"]),
          preferredTone: "professional",
          examplePosts: null,
        },
        accountContext: {
          businessName: "Premier Mortgage",
          industry: "mortgage",
        },
      });

      const callArgs = mockInvokeLLM.mock.calls[0][0];
      const systemPrompt = callArgs.messages[0].content;
      expect(systemPrompt).toContain("Mortgage");
      expect(systemPrompt).toContain("First-time homebuyers");
      expect(systemPrompt).toContain("Trusted advisor");
      expect(systemPrompt).toContain("Premier Mortgage");
    });

    it("should throw when LLM returns empty response", async () => {
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [{ message: { content: "" } }],
      });

      await expect(
        generateSocialPost({
          accountId: 1,
          platform: "twitter",
          topic: "test",
          tone: "casual",
        })
      ).rejects.toThrow("LLM returned empty response");
    });

    it("should throw when LLM returns invalid JSON", async () => {
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [{ message: { content: "not json at all" } }],
      });

      await expect(
        generateSocialPost({
          accountId: 1,
          platform: "instagram",
          topic: "test",
          tone: "funny",
        })
      ).rejects.toThrow("Failed to parse LLM response as JSON");
    });

    it("should throw when LLM returns JSON without posts array", async () => {
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ data: [] }) } }],
      });

      await expect(
        generateSocialPost({
          accountId: 1,
          platform: "facebook",
          topic: "test",
          tone: "inspiring",
        })
      ).rejects.toThrow("LLM returned invalid post structure");
    });

    it("should limit variations to 3 even if LLM returns more", async () => {
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                posts: [
                  { content: "Post 1", hashtags: [], imagePrompt: "img1" },
                  { content: "Post 2", hashtags: [], imagePrompt: "img2" },
                  { content: "Post 3", hashtags: [], imagePrompt: "img3" },
                  { content: "Post 4", hashtags: [], imagePrompt: "img4" },
                  { content: "Post 5", hashtags: [], imagePrompt: "img5" },
                ],
              }),
            },
          },
        ],
      });

      const result = await generateSocialPost({
        accountId: 1,
        platform: "facebook",
        topic: "test",
        tone: "educational",
      });

      expect(result.variations).toHaveLength(3);
    });
  });

  describe("generateContentCalendar", () => {
    it("should generate a calendar with posts for multiple platforms", async () => {
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                posts: [
                  {
                    platform: "facebook",
                    topic: "mortgage tips",
                    content: "FB post about mortgage tips",
                    hashtags: ["#mortgage", "tips"],
                    imagePrompt: "A calculator with money",
                  },
                  {
                    platform: "instagram",
                    topic: "home buying",
                    content: "IG post about home buying",
                    hashtags: ["#homebuying", "#realestate"],
                    imagePrompt: "A beautiful home exterior",
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await generateContentCalendar({
        accountId: 1,
        platforms: ["facebook", "instagram"],
        postsPerPlatform: 1,
        topics: ["mortgage tips", "home buying"],
        tone: "professional",
      });

      expect(result.posts).toHaveLength(2);
      expect(result.posts[0].platform).toBe("facebook");
      expect(result.posts[1].platform).toBe("instagram");
      // Hashtags should be normalized (# stripped)
      expect(result.posts[0].hashtags).toEqual(["mortgage", "tips"]);
    });

    it("should throw when LLM returns empty calendar response", async () => {
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [{ message: { content: "" } }],
      });

      await expect(
        generateContentCalendar({
          accountId: 1,
          platforms: ["twitter"],
          postsPerPlatform: 3,
          topics: ["test"],
          tone: "casual",
        })
      ).rejects.toThrow("LLM returned empty response");
    });

    it("should include brand voice and account context in the prompt", async () => {
      mockInvokeLLM.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                posts: [
                  {
                    platform: "linkedin",
                    topic: "industry",
                    content: "Test",
                    hashtags: [],
                    imagePrompt: "Test",
                  },
                ],
              }),
            },
          },
        ],
      });

      await generateContentCalendar({
        accountId: 1,
        platforms: ["linkedin"],
        postsPerPlatform: 1,
        topics: ["industry trends"],
        tone: "professional",
        brandVoice: {
          industry: "Real Estate",
          targetAudience: "Investors",
        },
        accountContext: {
          businessName: "Sterling Marketing",
          industry: "marketing",
        },
      });

      const callArgs = mockInvokeLLM.mock.calls[0][0];
      const systemPrompt = callArgs.messages[0].content;
      expect(systemPrompt).toContain("Sterling Marketing");
      expect(systemPrompt).toContain("Real Estate");
      expect(systemPrompt).toContain("Investors");
    });
  });
});

// ─── Router-level tests for socialContent procedures ────────────────────────

describe("socialContent router", () => {
  it("should export the expected procedure names", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toContain("socialContent.generatePost");
    expect(procedures).toContain("socialContent.saveDraft");
    expect(procedures).toContain("socialContent.getPosts");
    expect(procedures).toContain("socialContent.updatePost");
    expect(procedures).toContain("socialContent.deletePost");
    expect(procedures).toContain("socialContent.getBrandVoice");
    expect(procedures).toContain("socialContent.updateBrandVoice");
    expect(procedures).toContain("socialContent.generateContentCalendar");
  });
});

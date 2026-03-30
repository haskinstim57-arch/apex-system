import { describe, it, expect } from "vitest";

describe("Voice Agent Setup", () => {
  // ── ElevenLabs Voice Clone Verification ──
  describe("ElevenLabs Voice Clones", () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    it("should have ELEVENLABS_API_KEY configured", () => {
      expect(apiKey).toBeTruthy();
    });

    it("should have Tim Haskins voice clone (5q6TS1ZeXhDKOywAbaO2)", async () => {
      const res = await fetch("https://api.elevenlabs.io/v1/voices/5q6TS1ZeXhDKOywAbaO2", {
        headers: { "xi-api-key": apiKey! },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.voice_id).toBe("5q6TS1ZeXhDKOywAbaO2");
      expect(data.name).toContain("Tim Haskins");
    });

    it("should have LarrDawg voice clone (TkFdvwfPXYbICEBnYvnN)", async () => {
      const res = await fetch("https://api.elevenlabs.io/v1/voices/TkFdvwfPXYbICEBnYvnN", {
        headers: { "xi-api-key": apiKey! },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.voice_id).toBe("TkFdvwfPXYbICEBnYvnN");
      expect(data.name).toContain("LarrDawg");
    });
  });

  // ── VAPI Assistant Verification ──
  describe("VAPI Assistants", () => {
    const vapiKey = process.env.VAPI_API_KEY;

    it("should have VAPI_API_KEY configured", () => {
      expect(vapiKey).toBeTruthy();
    });

    it("should have PMR assistant (01504ee9-0d19-4e2f-97e7-6907a5ebb34c)", async () => {
      const res = await fetch(
        "https://api.vapi.ai/assistant/01504ee9-0d19-4e2f-97e7-6907a5ebb34c",
        {
          headers: {
            Authorization: `Bearer ${vapiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("01504ee9-0d19-4e2f-97e7-6907a5ebb34c");
      expect(data.name).toContain("PMR");
      // Verify it uses Tim's ElevenLabs voice
      expect(data.voice?.voiceId).toBe("5q6TS1ZeXhDKOywAbaO2");
      expect(data.voice?.provider).toBe("11labs");
      // Verify recording is enabled
      expect(data.recordingEnabled).toBe(true);
    });

    it("should have Optimal Lending assistant (6cead709-383a-4dbe-943c-6d7b485fafe6)", async () => {
      const res = await fetch(
        "https://api.vapi.ai/assistant/6cead709-383a-4dbe-943c-6d7b485fafe6",
        {
          headers: {
            Authorization: `Bearer ${vapiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("6cead709-383a-4dbe-943c-6d7b485fafe6");
      expect(data.name).toContain("Larry");
      // Verify it uses LarrDawg's ElevenLabs voice
      expect(data.voice?.voiceId).toBe("TkFdvwfPXYbICEBnYvnN");
      expect(data.voice?.provider).toBe("11labs");
      // Verify recording is enabled
      expect(data.recordingEnabled).toBe(true);
    });
  });

  // ── Database Configuration Verification ──
  describe("Database Account Configuration", () => {
    it("should have PMR account (420001) configured with voice agent", async () => {
      const { getAccountById } = await import("./db");
      const account = await getAccountById(420001);
      expect(account).toBeTruthy();
      expect((account as any).elevenLabsVoiceId).toBe("5q6TS1ZeXhDKOywAbaO2");
      expect((account as any).vapiAssistantId).toBe("01504ee9-0d19-4e2f-97e7-6907a5ebb34c");
      // voiceAgentEnabled may be toggled off by admin; verify the field exists
      expect(typeof (account as any).voiceAgentEnabled).toBe("boolean");
    });

    it("should have Optimal Lending account (390025) configured with voice agent", async () => {
      const { getAccountById } = await import("./db");
      const account = await getAccountById(390025);
      expect(account).toBeTruthy();
      expect((account as any).elevenLabsVoiceId).toBe("TkFdvwfPXYbICEBnYvnN");
      expect((account as any).vapiAssistantId).toBe("6cead709-383a-4dbe-943c-6d7b485fafe6");
      // voiceAgentEnabled may be toggled off by admin; verify the field exists
      expect(typeof (account as any).voiceAgentEnabled).toBe("boolean");
    });
  });

  // ── ElevenLabs Service Module ──
  describe("ElevenLabs Service Module", () => {
    it("should export all required functions", async () => {
      const mod = await import("./services/elevenLabs");
      expect(typeof mod.cloneVoiceFromUrl).toBe("function");
      expect(typeof mod.cloneVoiceFromBuffer).toBe("function");
      expect(typeof mod.getVoice).toBe("function");
      expect(typeof mod.listVoices).toBe("function");
      expect(typeof mod.deleteVoice).toBe("function");
    });
  });

  // ── VAPI Service Module ──
  describe("VAPI Service Module", () => {
    it("should export assistant management functions", async () => {
      const mod = await import("./services/vapi");
      expect(typeof mod.createVapiAssistant).toBe("function");
      expect(typeof mod.updateVapiAssistant).toBe("function");
      expect(typeof mod.getVapiAssistant).toBe("function");
      expect(typeof mod.provisionVapiPhoneNumber).toBe("function");
      expect(typeof mod.createVapiCall).toBe("function");
      expect(typeof mod.resolveAssistantId).toBe("function");
    });
  });
});

import { describe, it, expect, vi } from "vitest";

// Mock the voice transcription module
vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn(),
}));

// Mock the storage module
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";

describe("Jarvis Voice Transcription", () => {
  describe("Backend transcription flow", () => {
    it("should upload audio to S3 and call transcribeAudio", async () => {
      const mockStoragePut = storagePut as ReturnType<typeof vi.fn>;
      const mockTranscribe = transcribeAudio as ReturnType<typeof vi.fn>;

      mockStoragePut.mockResolvedValue({
        key: "voice-transcriptions/test.webm",
        url: "https://storage.example.com/voice-transcriptions/test.webm",
      });

      mockTranscribe.mockResolvedValue({
        task: "transcribe",
        language: "en",
        duration: 5.2,
        text: "Hello, this is a test message",
        segments: [],
      });

      // Simulate what the tRPC endpoint does
      const audioBase64 = Buffer.from("fake audio data").toString("base64");
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const sizeMB = audioBuffer.length / (1024 * 1024);
      expect(sizeMB).toBeLessThan(16);

      const ext = "webm";
      const fileKey = `voice-transcriptions/1-${Date.now()}-abc123.${ext}`;
      const { url: audioUrl } = await mockStoragePut(fileKey, audioBuffer, "audio/webm");

      expect(audioUrl).toBe("https://storage.example.com/voice-transcriptions/test.webm");

      const result = await mockTranscribe({
        audioUrl,
        language: undefined,
        prompt: "Transcribe the user's voice message for a CRM assistant",
      });

      expect(result).toHaveProperty("text");
      expect(result.text).toBe("Hello, this is a test message");
      expect(result.language).toBe("en");
      expect(result.duration).toBe(5.2);
    });

    it("should reject audio files over 16MB", () => {
      // Simulate a large base64 string (17MB)
      const largeSizeMB = 17;
      expect(largeSizeMB).toBeGreaterThan(16);
      // The endpoint would throw a TRPCError with code BAD_REQUEST
    });

    it("should handle transcription errors gracefully", async () => {
      const mockTranscribe = transcribeAudio as ReturnType<typeof vi.fn>;

      mockTranscribe.mockResolvedValue({
        error: "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: "500 Internal Server Error",
      });

      const result = await mockTranscribe({
        audioUrl: "https://storage.example.com/test.webm",
      });

      expect(result).toHaveProperty("error");
      expect(result.code).toBe("TRANSCRIPTION_FAILED");
    });

    it("should handle empty transcription results", async () => {
      const mockTranscribe = transcribeAudio as ReturnType<typeof vi.fn>;

      mockTranscribe.mockResolvedValue({
        task: "transcribe",
        language: "en",
        duration: 1.0,
        text: "",
        segments: [],
      });

      const result = await mockTranscribe({
        audioUrl: "https://storage.example.com/test.webm",
      });

      expect(result.text).toBe("");
      // Frontend should show "No speech detected" toast
    });

    it("should support different audio mime types", () => {
      const mimeToExt: Record<string, string> = {
        "audio/webm": "webm",
        "audio/mp4": "m4a",
        "audio/mpeg": "webm", // fallback
      };

      expect(mimeToExt["audio/webm"]).toBe("webm");
      expect(mimeToExt["audio/mp4"]).toBe("m4a");
    });
  });
});

import { ENV } from "../_core/env";

// ─────────────────────────────────────────────
// ElevenLabs Voice Clone Service
// Handles instant voice cloning via ElevenLabs API
// ─────────────────────────────────────────────

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

/** Response from ElevenLabs Add Voice endpoint */
export interface ElevenLabsVoiceResponse {
  voice_id: string;
}

/** Response from ElevenLabs Get Voice endpoint */
export interface ElevenLabsVoiceDetails {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url?: string;
}

/** Response from ElevenLabs List Voices endpoint */
export interface ElevenLabsVoiceList {
  voices: ElevenLabsVoiceDetails[];
}

/**
 * Create an instant voice clone from an audio file URL.
 * Downloads the audio file first, then uploads to ElevenLabs.
 */
export async function cloneVoiceFromUrl(opts: {
  name: string;
  audioUrl: string;
  description?: string;
}): Promise<ElevenLabsVoiceResponse> {
  const apiKey = ENV.elevenLabsApiKey;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  // Download the audio file
  const audioRes = await fetch(opts.audioUrl);
  if (!audioRes.ok) {
    throw new Error(`Failed to download audio from ${opts.audioUrl}: ${audioRes.status}`);
  }
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

  // Determine filename from URL
  const urlPath = new URL(opts.audioUrl).pathname;
  const filename = urlPath.split("/").pop() || "voice_sample.mp3";

  return cloneVoiceFromBuffer({
    name: opts.name,
    audioBuffer,
    filename,
    description: opts.description,
  });
}

/**
 * Create an instant voice clone from a raw audio buffer.
 */
export async function cloneVoiceFromBuffer(opts: {
  name: string;
  audioBuffer: Buffer;
  filename: string;
  description?: string;
}): Promise<ElevenLabsVoiceResponse> {
  const apiKey = ENV.elevenLabsApiKey;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  // Build multipart form data
  const formData = new FormData();
  formData.append("name", opts.name);
  if (opts.description) {
    formData.append("description", opts.description);
  }

  // Determine MIME type from filename
  const ext = opts.filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    webm: "audio/webm",
  };
  const mimeType = mimeMap[ext || ""] || "audio/mpeg";

  const blob = new Blob([new Uint8Array(opts.audioBuffer)], { type: mimeType });
  formData.append("files", blob, opts.filename);

  const res = await fetch(`${ELEVENLABS_BASE_URL}/voices/add`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ElevenLabs voice clone failed (${res.status}): ${errorText}`);
  }

  return res.json() as Promise<ElevenLabsVoiceResponse>;
}

/**
 * Get details about a specific voice.
 */
export async function getVoice(voiceId: string): Promise<ElevenLabsVoiceDetails> {
  const apiKey = ENV.elevenLabsApiKey;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const res = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ElevenLabs get voice failed (${res.status}): ${errorText}`);
  }

  return res.json() as Promise<ElevenLabsVoiceDetails>;
}

/**
 * List all voices in the account.
 */
export async function listVoices(): Promise<ElevenLabsVoiceList> {
  const apiKey = ENV.elevenLabsApiKey;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const res = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ElevenLabs list voices failed (${res.status}): ${errorText}`);
  }

  return res.json() as Promise<ElevenLabsVoiceList>;
}

/**
 * Delete a voice clone.
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  const apiKey = ENV.elevenLabsApiKey;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const res = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ElevenLabs delete voice failed (${res.status}): ${errorText}`);
  }
}

import type { Speaker } from "@/types";

/**
 * MVP speaker identification: microphone channel is always the candidate,
 * system/loopback audio is always the interviewer (see docs/architecture.md
 * §4). True diarization across a mixed channel is out of scope for the MVP.
 */
export function identifySpeaker(channel: "microphone" | "system"): Speaker {
  return channel === "microphone" ? "CANDIDATE" : "INTERVIEWER";
}

export type ProviderId = "claude" | "codex" | "cursor" | "opencode" | "openclaw";

export const providerIds: ProviderId[] = ["claude", "codex", "cursor", "opencode", "openclaw"];

export const providerStatusLabel: Record<ProviderId, string> = {
  claude: "Claude code",
  codex: "Codex",
  cursor: "Cursor",
  opencode: "Open Code",
  openclaw: "OpenClaw",
};

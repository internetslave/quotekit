// Progressive-enhancement haptic feedback wrapper. On iOS Safari PWAs the
// Vibration API is gated behind user interaction, so calls before a first
// touch are silently ignored — that's fine, they aren't critical.

type Pattern = "light" | "success" | "error" | "celebration";

const PATTERNS: Record<Pattern, number | number[]> = {
  light: 10,
  success: [10, 30, 10],
  error: [25, 40, 25],
  celebration: [12, 40, 12, 40, 12, 40, 40]
};

export function haptic(pattern: Pattern): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Vibration unsupported on this device — silent no-op.
  }
}

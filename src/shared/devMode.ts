/**
 * Single switch for developer-only UI and telemetry.
 *
 * - `true`  → Reset, Report Issue, profile/preferences JSON import/export,
 *             and debug telemetry are available (local development).
 * - `false` → user/release mode for store packaging.
 *
 * Flip this one constant before publishing. Do not ship with `true`.
 */
export const DEV_MODE = false;

export function isDevMode(): boolean {
  return DEV_MODE;
}

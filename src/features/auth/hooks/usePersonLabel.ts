"use client";
import { useAuth } from "./useAuth";

/**
 * Google subjects are internal identifiers and must never be shown. Until the backend returns display names for
 * every actor, a person is shown only when it is the signed-in user; otherwise the segment is omitted entirely.
 * The result already includes the " · " separator so callers can append it without leaving dangling separators.
 */
export function usePersonLabel() {
  const { user } = useAuth();
  return (prefix: string, subject: string | null | undefined): string => {
    if (!user || !subject || subject !== user.subject) return "";
    const name = user.name || user.email || "Tú";
    return ` · ${prefix ? `${prefix}: ` : ""}${name}`;
  };
}

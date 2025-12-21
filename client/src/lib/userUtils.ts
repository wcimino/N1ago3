import type { UserProfile, User as UserType } from "../types";

export function getUserDisplayNameFromProfile(profile: UserProfile | null | undefined, fallbackId?: string): string {
  if (profile) {
    if (profile.givenName || profile.surname) {
      return `${profile.givenName || ""} ${profile.surname || ""}`.trim();
    }
    if (profile.email) {
      return profile.email;
    }
  }
  if (fallbackId) {
    return fallbackId;
  }
  return "Usuário desconhecido";
}

export function formatUserEmail(profile: UserProfile | null | undefined): string | null {
  return profile?.email || null;
}

export function isUserAuthenticated(user: UserType): boolean {
  return user.authenticated ?? false;
}

export function truncateUserId(id: string, length: number = 12): string {
  if (id.length <= length) return id;
  return id.slice(0, length) + "...";
}

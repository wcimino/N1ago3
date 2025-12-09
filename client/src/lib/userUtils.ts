import type { UserProfile, UserGroup, UserConversation, User as UserType } from "../types";

export function getUserDisplayName(group: UserGroup): string {
  if (group.user_info?.profile) {
    const profile = group.user_info.profile as UserProfile;
    if (profile.givenName || profile.surname) {
      return `${profile.givenName || ""} ${profile.surname || ""}`.trim();
    }
    if (profile.email) {
      return profile.email;
    }
  }
  return group.user_id;
}

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

export function getActiveConversationsCount(conversations: UserConversation[]): number {
  return conversations.filter((c) => c.status === "active").length;
}

export function getUserFromGroup(group: UserGroup): UserType | null {
  if (!group.user_info) return null;
  return {
    id: group.user_info.id,
    sunshine_id: group.user_id,
    external_id: group.user_info.external_id || null,
    authenticated: group.user_info.authenticated,
    profile: group.user_info.profile as UserProfile | null,
    first_seen_at: group.first_activity,
    last_seen_at: group.last_activity,
  };
}

export function formatUserEmail(profile: UserProfile | null | undefined): string | null {
  return profile?.email || null;
}

export function isUserAuthenticated(user: UserType | UserGroup): boolean {
  if ('user_info' in user) {
    return user.user_info?.authenticated ?? false;
  }
  return user.authenticated ?? false;
}

export function truncateUserId(id: string, length: number = 12): string {
  if (id.length <= length) return id;
  return id.slice(0, length) + "...";
}

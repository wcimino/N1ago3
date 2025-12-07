export interface UserProfile {
  email?: string;
  givenName?: string;
  surname?: string;
  locale?: string;
}

export interface User {
  id: number;
  sunshine_id: string;
  external_id: string | null;
  authenticated: boolean;
  profile: UserProfile | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface UsersResponse {
  total: number;
  offset: number;
  limit: number;
  users: User[];
}

export interface UsersStatsResponse {
  total: number;
  authenticated: number;
  anonymous: number;
}

export interface AuthorizedUser {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  createdBy: string | null;
  lastAccess: string | null;
}

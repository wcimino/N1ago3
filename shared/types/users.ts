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
  createdAt: Date;
  createdBy: string | null;
  lastAccess: Date | null;
}

export interface StandardUser {
  email: string;
  source: string;
  sourceUserId?: string;
  externalId?: string;
  name?: string;
  cpf?: string;
  phone?: string;
  locale?: string;
  signedUpAt?: Date;
  metadata?: any;
}

export interface ExtractedUser {
  externalId: string;
  signedUpAt?: Date;
  authenticated?: boolean;
  profile?: any;
  metadata?: any;
  identities?: any;
}

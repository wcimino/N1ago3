import type { StandardOrganization } from "../types.js";

export function extractValidCnpjRoot(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length >= 8 && digitsOnly.length <= 14) {
    return digitsOnly.slice(0, 8);
  }
  return undefined;
}

export function extractStandardOrganization(rawPayload: any, source: string): StandardOrganization | null {
  const events = rawPayload.events || [];
  
  for (const event of events) {
    const payload = event.payload || {};
    const userData = payload.user || payload.activity?.author?.user || rawPayload.user;
    
    if (userData?.profile?.givenName) {
      const cnpjRoot = extractValidCnpjRoot(userData.profile.givenName);
      
      if (cnpjRoot) {
        return {
          cnpjRoot,
          source,
          metadata: userData.metadata,
        };
      }
    }
  }

  if (rawPayload.user?.profile?.givenName) {
    const cnpjRoot = extractValidCnpjRoot(rawPayload.user.profile.givenName);
    
    if (cnpjRoot) {
      return {
        cnpjRoot,
        source,
        metadata: rawPayload.user.metadata,
      };
    }
  }

  return null;
}

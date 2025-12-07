import type { ExtractedUser, StandardUser } from "../types.js";

export function extractValidCpf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length === 11) {
    return digitsOnly;
  }
  return undefined;
}

export function extractUser(rawPayload: any): ExtractedUser | null {
  const events = rawPayload.events || [];
  
  for (const event of events) {
    const payload = event.payload || {};
    const userData = payload.user || payload.activity?.author?.user || rawPayload.user;
    
    if (userData?.id) {
      let signedUpAt: Date | undefined;
      if (userData.signedUpAt) {
        try {
          signedUpAt = new Date(userData.signedUpAt);
        } catch {}
      }

      return {
        externalId: userData.id,
        signedUpAt,
        authenticated: userData.authenticated,
        profile: userData.profile,
        metadata: userData.metadata,
        identities: userData.identities,
      };
    }
  }

  if (rawPayload.user?.id) {
    return {
      externalId: rawPayload.user.id,
      authenticated: rawPayload.user.authenticated,
      profile: rawPayload.user.profile,
      metadata: rawPayload.user.metadata,
      identities: rawPayload.user.identities,
    };
  }

  return null;
}

export function extractStandardUser(rawPayload: any, source: string): StandardUser | null {
  const events = rawPayload.events || [];
  
  for (const event of events) {
    const payload = event.payload || {};
    const userData = payload.user || payload.activity?.author?.user || rawPayload.user;
    
    if (userData?.profile?.email) {
      const profile = userData.profile || {};
      
      let signedUpAt: Date | undefined;
      if (userData.signedUpAt) {
        try {
          signedUpAt = new Date(userData.signedUpAt);
        } catch {}
      }

      return {
        email: profile.email.toLowerCase().trim(),
        source,
        sourceUserId: userData.id,
        externalId: userData.externalId,
        name: profile.surname || undefined,
        cpf: extractValidCpf(profile.givenName),
        phone: profile.phone || undefined,
        locale: profile.locale || undefined,
        signedUpAt,
        metadata: userData.metadata,
      };
    }
  }

  if (rawPayload.user?.profile?.email) {
    const user = rawPayload.user;
    const profile = user.profile || {};
    
    let signedUpAt: Date | undefined;
    if (user.signedUpAt) {
      try {
        signedUpAt = new Date(user.signedUpAt);
      } catch {}
    }

    return {
      email: profile.email.toLowerCase().trim(),
      source,
      sourceUserId: user.id,
      externalId: user.externalId,
      name: profile.surname || undefined,
      cpf: extractValidCpf(profile.givenName),
      phone: profile.phone || undefined,
      locale: profile.locale || undefined,
      signedUpAt,
      metadata: user.metadata,
    };
  }

  return null;
}

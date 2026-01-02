import { db } from "../../../db.js";
import { users } from "../../../../shared/schema.js";
import { eq } from "drizzle-orm";

export interface AuthenticationResult {
  authenticated: boolean;
  resolvedVia: "userExternalId" | "externalUserId" | "none";
  error?: string;
}

export async function resolveAuthentication(params: {
  userExternalId?: string;
  externalUserId?: string;
}): Promise<AuthenticationResult> {
  const { userExternalId, externalUserId } = params;

  try {
    if (userExternalId) {
      const [user] = await db.select({ authenticated: users.authenticated })
        .from(users)
        .where(eq(users.externalId, userExternalId));
      
      if (user) {
        console.log(`[AuthenticationResolver] Resolved via userExternalId: ${userExternalId}, authenticated: ${user.authenticated}`);
        return {
          authenticated: user.authenticated ?? false,
          resolvedVia: "userExternalId",
        };
      }
    }

    if (externalUserId) {
      const [user] = await db.select({ authenticated: users.authenticated })
        .from(users)
        .where(eq(users.externalId, externalUserId));
      
      if (user) {
        console.log(`[AuthenticationResolver] Resolved via externalUserId: ${externalUserId}, authenticated: ${user.authenticated}`);
        return {
          authenticated: user.authenticated ?? false,
          resolvedVia: "externalUserId",
        };
      }
    }

    console.log(`[AuthenticationResolver] No user found for userExternalId: ${userExternalId}, externalUserId: ${externalUserId}`);
    return {
      authenticated: false,
      resolvedVia: "none",
    };
  } catch (error) {
    console.error("[AuthenticationResolver] Error resolving authentication:", error);
    return {
      authenticated: false,
      resolvedVia: "none",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

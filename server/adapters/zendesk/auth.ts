import crypto from "crypto";

export interface AuthVerificationResult {
  isValid: boolean;
  errorMessage?: string;
}

export function verifyZendeskAuth(
  rawBody: Buffer,
  headers: Record<string, string>,
  secret?: string
): AuthVerificationResult {
  if (!secret) {
    return { isValid: true };
  }

  const apiKey = headers["x-api-key"];
  if (apiKey) {
    const isValid = apiKey === secret;
    if (isValid) {
      return { isValid: true };
    }
    return { isValid: false, errorMessage: "x-api-key inválida" };
  }

  const signature = headers["x-smooch-signature"] || headers["x-zendesk-webhook-signature"];
  if (signature) {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    
    const normalizedSignature = signature.startsWith("sha256=") 
      ? signature.slice(7) 
      : signature;
    
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(normalizedSignature, "hex")
      );
      
      if (isValid) {
        return { isValid: true };
      }
    } catch {}
    
    return { isValid: false, errorMessage: "Assinatura HMAC inválida" };
  }

  return { 
    isValid: false, 
    errorMessage: "Autenticação ausente - header x-api-key, X-Smooch-Signature ou X-Zendesk-Webhook-Signature não encontrado" 
  };
}

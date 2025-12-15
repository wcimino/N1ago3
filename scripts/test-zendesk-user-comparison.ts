import { getAuthHeader, getBaseUrl, type ZendeskUserApiResponse } from "../server/features/external-sources/zendesk/services/zendeskSupportUsersApiClient.js";

interface ZendeskUsersSearchResponse {
  users: ZendeskUserApiResponse[];
  next_page: string | null;
  count: number;
}

const TEST_EXTERNAL_IDS = [
  "01368318-3b47-48fb-8bd4-adecf501dffa",
  "02fc16ec-4d11-41c5-9849-b96ccfe8474d",
  "093f1bc3-2135-4058-9ccc-84678ffe6339",
  "0a0e2fd3-a254-4586-922d-2b29785dec2c",
  "0acc9018-425d-4d96-a4ca-fabb6e6624bc",
];

async function searchByExternalId(externalId: string): Promise<ZendeskUserApiResponse | null> {
  const url = `${getBaseUrl()}/api/v2/users/search.json?external_id=${encodeURIComponent(externalId)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`  [external_id] Error ${response.status}: ${await response.text()}`);
      return null;
    }

    const data: ZendeskUsersSearchResponse = await response.json();
    return data.users?.[0] ?? null;
  } catch (error) {
    console.error(`  [external_id] Error:`, error);
    return null;
  }
}

async function searchByEmail(email: string): Promise<ZendeskUserApiResponse | null> {
  const url = `${getBaseUrl()}/api/v2/users/search.json?query=email:${encodeURIComponent(email)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`  [email] Error ${response.status}: ${await response.text()}`);
      return null;
    }

    const data: ZendeskUsersSearchResponse = await response.json();
    return data.users?.[0] ?? null;
  } catch (error) {
    console.error(`  [email] Error:`, error);
    return null;
  }
}

function formatUser(user: ZendeskUserApiResponse | null): string {
  if (!user) return "  (não encontrado)";
  return `
  ID: ${user.id}
  Name: ${user.name}
  Email: ${user.email}
  Phone: ${user.phone || "(sem telefone)"}
  External ID: ${user.external_id || "(sem external_id)"}
  Role: ${user.role}
  Created: ${user.created_at}
  Tags: ${user.tags?.join(", ") || "(sem tags)"}`;
}

async function main() {
  console.log("=== Teste Detalhado: Comparação de Usuários por external_id vs email ===\n");
  console.log("Passo 1: Buscar usuários por external_id");
  console.log("Passo 2: Usar o email retornado para buscar novamente");
  console.log("Passo 3: Comparar os resultados\n");
  console.log("=".repeat(80) + "\n");
  
  for (const externalId of TEST_EXTERNAL_IDS) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`TESTE: external_id = ${externalId}`);
    console.log("=".repeat(80));
    
    // Passo 1: Buscar por external_id
    console.log("\n--- PASSO 1: Busca por external_id ---");
    const userByExternalId = await searchByExternalId(externalId);
    
    if (!userByExternalId) {
      console.log("  Usuário NÃO encontrado por external_id");
      continue;
    }
    
    console.log("  Usuário encontrado por external_id:");
    console.log(formatUser(userByExternalId));
    
    // Passo 2: Buscar pelo email retornado
    const email = userByExternalId.email;
    if (!email) {
      console.log("\n--- PASSO 2: Busca por email ---");
      console.log("  O usuário não tem email, não é possível comparar");
      continue;
    }
    
    console.log(`\n--- PASSO 2: Busca por email (${email}) ---`);
    const userByEmail = await searchByEmail(email);
    
    if (!userByEmail) {
      console.log("  Usuário NÃO encontrado por email");
      console.log("\n--- CONCLUSÃO ---");
      console.log("  ⚠️ Email não encontra usuário no Zendesk Support");
      console.log("  → Usar external_id é a única opção para esse usuário");
      continue;
    }
    
    console.log("  Usuário encontrado por email:");
    console.log(formatUser(userByEmail));
    
    // Passo 3: Comparar
    console.log("\n--- PASSO 3: Comparação ---");
    const sameId = userByExternalId.id === userByEmail.id;
    const sameName = userByExternalId.name === userByEmail.name;
    const samePhone = userByExternalId.phone === userByEmail.phone;
    const sameExternalId = userByExternalId.external_id === userByEmail.external_id;
    
    console.log(`  IDs iguais: ${sameId ? "✅ SIM" : "❌ NÃO"} (${userByExternalId.id} vs ${userByEmail.id})`);
    console.log(`  Nomes iguais: ${sameName ? "✅ SIM" : "❌ NÃO"} ("${userByExternalId.name}" vs "${userByEmail.name}")`);
    console.log(`  Telefones iguais: ${samePhone ? "✅ SIM" : "❌ NÃO"} (${userByExternalId.phone} vs ${userByEmail.phone})`);
    console.log(`  External IDs iguais: ${sameExternalId ? "✅ SIM" : "❌ NÃO"} (${userByExternalId.external_id} vs ${userByEmail.external_id})`);
    
    console.log("\n--- CONCLUSÃO ---");
    if (sameId) {
      console.log("  ✅ Mesmo usuário - external_id e email retornam o mesmo registro");
    } else {
      console.log("  ❌ REGISTROS DIFERENTES - São usuários distintos no Zendesk!");
      console.log("  → O usuário por external_id é do Sunshine Conversations");
      console.log("  → O usuário por email é um registro separado no Zendesk Support");
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log("\n\n" + "=".repeat(80));
  console.log("RESUMO FINAL");
  console.log("=".repeat(80));
  console.log(`
A busca por external_id retorna usuários criados pelo Sunshine Conversations.
A busca por email pode retornar usuários diferentes, criados diretamente no Zendesk Support.

RECOMENDAÇÃO:
- Se o objetivo é enriquecer dados do usuário atual (do Sunshine), use external_id
- Se o objetivo é buscar histórico do usuário no Zendesk Support, use email
- Ambos podem ser válidos dependendo do caso de uso
`);
}

main().catch(console.error);

import { getAuthHeader, getBaseUrl, type ZendeskUserApiResponse } from "../server/features/external-sources/zendesk/services/zendeskSupportUsersApiClient.js";

interface ZendeskUsersSearchResponse {
  users: ZendeskUserApiResponse[];
  next_page: string | null;
  count: number;
}

const TEST_USERS = [
  { externalId: "01368318-3b47-48fb-8bd4-adecf501dffa", email: "dongiovannicremeria@gmail.com" },
  { externalId: "02fc16ec-4d11-41c5-9849-b96ccfe8474d", email: "markinhosqwe@gmail.com" },
  { externalId: "093f1bc3-2135-4058-9ccc-84678ffe6339", email: "pauletas1998@icloud.com" },
  { externalId: "0a0e2fd3-a254-4586-922d-2b29785dec2c", email: "pasinieder@gmail.com" },
  { externalId: "0acc9018-425d-4d96-a4ca-fabb6e6624bc", email: "ha.line.oliveira18@gmail.com" },
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

async function main() {
  console.log("=== Teste: Busca por external_id vs email na API Zendesk ===\n");
  
  let successCount = 0;
  let matchCount = 0;
  
  for (const user of TEST_USERS) {
    console.log(`\nTestando: ${user.email}`);
    console.log(`  external_id: ${user.externalId}`);
    
    const [byExternal, byEmail] = await Promise.all([
      searchByExternalId(user.externalId),
      searchByEmail(user.email),
    ]);
    
    const externalFound = byExternal !== null;
    const emailFound = byEmail !== null;
    
    console.log(`  Resultado por external_id: ${externalFound ? `ENCONTRADO (id: ${byExternal!.id})` : "NÃO ENCONTRADO"}`);
    console.log(`  Resultado por email: ${emailFound ? `ENCONTRADO (id: ${byEmail!.id})` : "NÃO ENCONTRADO"}`);
    
    if (externalFound) successCount++;
    
    if (externalFound && emailFound) {
      const match = byExternal!.id === byEmail!.id;
      console.log(`  IDs coincidem: ${match ? "SIM" : "NÃO"}`);
      if (match) matchCount++;
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log("\n=== Resumo ===");
  console.log(`Buscas por external_id bem-sucedidas: ${successCount}/${TEST_USERS.length}`);
  console.log(`IDs coincidentes (external_id vs email): ${matchCount}/${TEST_USERS.length}`);
  
  if (successCount === TEST_USERS.length) {
    console.log("\n✅ Busca por external_id funciona! Pode ser usada como alternativa ao email.");
  } else {
    console.log("\n⚠️ Busca por external_id não funcionou para todos os usuários.");
  }
}

main().catch(console.error);

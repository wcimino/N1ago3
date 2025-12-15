import { getAuthHeader, getBaseUrl, type ZendeskUserApiResponse } from "../server/features/external-sources/zendesk/services/zendeskSupportUsersApiClient.js";
import { db } from "../server/db.js";
import { usersStandard } from "../shared/schema.js";
import { isNotNull, ne, sql } from "drizzle-orm";

interface ZendeskUsersSearchResponse {
  users: ZendeskUserApiResponse[];
  next_page: string | null;
  count: number;
}

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
      return null;
    }

    const data: ZendeskUsersSearchResponse = await response.json();
    return data.users?.[0] ?? null;
  } catch (error) {
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
      return null;
    }

    const data: ZendeskUsersSearchResponse = await response.json();
    return data.users?.[0] ?? null;
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log("=== Teste com 100 Usuários: external_id vs email ===\n");
  
  const users = await db
    .select({ externalId: usersStandard.externalId, email: usersStandard.email })
    .from(usersStandard)
    .where(sql`${usersStandard.externalId} IS NOT NULL AND ${usersStandard.externalId} != ''`)
    .limit(100);
  
  console.log(`Total de usuários para testar: ${users.length}\n`);
  
  let stats = {
    total: 0,
    foundByExternalId: 0,
    foundByEmail: 0,
    externalIdHasEmail: 0,
    sameUser: 0,
    differentUser: 0,
    onlyExternalId: 0,
    onlyEmail: 0,
    neitherFound: 0,
  };
  
  const results: any[] = [];
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    stats.total++;
    
    if (i % 10 === 0) {
      console.log(`Progresso: ${i}/${users.length}...`);
    }
    
    const byExternalId = await searchByExternalId(user.externalId!);
    await new Promise(r => setTimeout(r, 100));
    
    const byEmail = await searchByEmail(user.email);
    await new Promise(r => setTimeout(r, 100));
    
    const foundByExt = byExternalId !== null;
    const foundByEmail = byEmail !== null;
    const extHasEmail = byExternalId?.email !== null && byExternalId?.email !== undefined;
    
    if (foundByExt) stats.foundByExternalId++;
    if (foundByEmail) stats.foundByEmail++;
    if (extHasEmail) stats.externalIdHasEmail++;
    
    let comparison = "N/A";
    if (foundByExt && foundByEmail) {
      if (byExternalId!.id === byEmail!.id) {
        stats.sameUser++;
        comparison = "SAME";
      } else {
        stats.differentUser++;
        comparison = "DIFFERENT";
      }
    } else if (foundByExt && !foundByEmail) {
      stats.onlyExternalId++;
      comparison = "ONLY_EXT";
    } else if (!foundByExt && foundByEmail) {
      stats.onlyEmail++;
      comparison = "ONLY_EMAIL";
    } else {
      stats.neitherFound++;
      comparison = "NONE";
    }
    
    results.push({
      externalId: user.externalId,
      email: user.email,
      foundByExt,
      foundByEmail,
      extZendeskId: byExternalId?.id || null,
      emailZendeskId: byEmail?.id || null,
      extHasEmail,
      extEmail: byExternalId?.email || null,
      comparison,
    });
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("ESTATÍSTICAS FINAIS");
  console.log("=".repeat(80));
  console.log(`\nTotal testado: ${stats.total}`);
  console.log(`\n--- Resultados de Busca ---`);
  console.log(`Encontrados por external_id: ${stats.foundByExternalId} (${(stats.foundByExternalId/stats.total*100).toFixed(1)}%)`);
  console.log(`Encontrados por email: ${stats.foundByEmail} (${(stats.foundByEmail/stats.total*100).toFixed(1)}%)`);
  console.log(`\n--- Usuários por external_id COM email no Zendesk ---`);
  console.log(`Com email preenchido: ${stats.externalIdHasEmail} (${(stats.externalIdHasEmail/stats.total*100).toFixed(1)}%)`);
  console.log(`\n--- Comparação de Resultados ---`);
  console.log(`MESMO usuário (IDs iguais): ${stats.sameUser}`);
  console.log(`DIFERENTE usuário (IDs diferentes): ${stats.differentUser}`);
  console.log(`Só encontrado por external_id: ${stats.onlyExternalId}`);
  console.log(`Só encontrado por email: ${stats.onlyEmail}`);
  console.log(`Não encontrado em nenhum: ${stats.neitherFound}`);
  
  console.log("\n\n--- Detalhes dos casos DIFERENTE ---");
  const differentCases = results.filter(r => r.comparison === "DIFFERENT");
  for (const r of differentCases.slice(0, 10)) {
    console.log(`\n  Email: ${r.email}`);
    console.log(`  External ID: ${r.externalId}`);
    console.log(`  Zendesk ID (via ext): ${r.extZendeskId}`);
    console.log(`  Zendesk ID (via email): ${r.emailZendeskId}`);
    console.log(`  Usuário por ext tem email? ${r.extHasEmail ? `SIM (${r.extEmail})` : "NÃO"}`);
  }
  
  if (differentCases.length > 10) {
    console.log(`\n  ... e mais ${differentCases.length - 10} casos`);
  }
  
  console.log("\n\n" + "=".repeat(80));
  console.log("CONCLUSÃO");
  console.log("=".repeat(80));
  
  if (stats.sameUser > 0 && stats.differentUser === 0) {
    console.log("\n✅ SEGURO: Todos os usuários encontrados por ambos os métodos são o MESMO registro.");
  } else if (stats.differentUser > 0) {
    console.log(`\n⚠️ ATENÇÃO: ${stats.differentUser} usuários retornam registros DIFERENTES!`);
    console.log("   Isso significa que external_id e email podem buscar pessoas diferentes no Zendesk.");
  }
  
  process.exit(0);
}

main().catch(console.error);

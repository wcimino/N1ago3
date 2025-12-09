import { db } from "../../../db.js";
import { openaiApiConfigGeneral, type OpenaiApiConfigGeneral, type InsertOpenaiApiConfigGeneral } from "../../../../shared/schema.js";
import { eq, asc } from "drizzle-orm";

export const GENERAL_SETTINGS_TYPES = [
  "communication_style",
  "behavior_guidelines",
  "guardrails",
  "escalation_policy",
] as const;

export type GeneralSettingType = typeof GENERAL_SETTINGS_TYPES[number];

export const GENERAL_SETTINGS_LABELS: Record<GeneralSettingType, { title: string; description: string; placeholder: string }> = {
  communication_style: {
    title: "Estilo de Comunicação",
    description: "Defina o tom, formalidade e estilo de linguagem dos agentes",
    placeholder: "Ex: Use linguagem cordial e acessível. Evite jargões técnicos. Seja empático e profissional...",
  },
  behavior_guidelines: {
    title: "Diretrizes de Comportamento",
    description: "Defina como os agentes devem agir e se comportar",
    placeholder: "Ex: Sempre confirme o entendimento antes de responder. Ofereça alternativas quando possível...",
  },
  guardrails: {
    title: "Guardrails (Limites e Segurança)",
    description: "Defina limites, restrições e tópicos proibidos",
    placeholder: "Ex: Nunca forneça informações bancárias completas. Não faça promessas de aprovação...",
  },
  escalation_policy: {
    title: "Política de Escalação",
    description: "Defina quando e como escalar para atendimento humano",
    placeholder: "Ex: Escale quando o cliente mencionar 'falar com gerente'. Escale após 3 tentativas sem sucesso...",
  },
};

export const generalSettingsStorage = {
  async getAll(): Promise<OpenaiApiConfigGeneral[]> {
    return db
      .select()
      .from(openaiApiConfigGeneral)
      .orderBy(asc(openaiApiConfigGeneral.id));
  },

  async getByType(configType: GeneralSettingType): Promise<OpenaiApiConfigGeneral | null> {
    const result = await db
      .select()
      .from(openaiApiConfigGeneral)
      .where(eq(openaiApiConfigGeneral.configType, configType))
      .limit(1);
    return result[0] || null;
  },

  async getAllEnabled(): Promise<OpenaiApiConfigGeneral[]> {
    return db
      .select()
      .from(openaiApiConfigGeneral)
      .where(eq(openaiApiConfigGeneral.enabled, true))
      .orderBy(asc(openaiApiConfigGeneral.id));
  },

  async upsert(configType: GeneralSettingType, data: { enabled: boolean; content: string }): Promise<OpenaiApiConfigGeneral> {
    const existing = await this.getByType(configType);

    if (existing) {
      const [updated] = await db
        .update(openaiApiConfigGeneral)
        .set({
          enabled: data.enabled,
          content: data.content,
          updatedAt: new Date(),
        })
        .where(eq(openaiApiConfigGeneral.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(openaiApiConfigGeneral)
      .values({
        configType,
        enabled: data.enabled,
        content: data.content,
      })
      .returning();
    return created;
  },

  async getConcatenatedContent(): Promise<string> {
    const allSettings = await this.getAll();
    const settingsWithContent = allSettings.filter(s => s.content && s.content.trim().length > 0);
    
    if (settingsWithContent.length === 0) return "";

    const sections = settingsWithContent.map((setting) => {
      const label = GENERAL_SETTINGS_LABELS[setting.configType as GeneralSettingType];
      return `## ${label?.title || setting.configType}\n${setting.content}`;
    });

    return sections.join("\n\n");
  },
};

import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireAuthorizedUser } from "../../../features/auth/index.js";
import { 
  generalSettingsStorage, 
  GENERAL_SETTINGS_TYPES, 
  GENERAL_SETTINGS_LABELS,
  type GeneralSettingType 
} from "../storage/generalSettingsStorage.js";

const router = Router();

router.get("/api/openai-config-general", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const allSettings = await generalSettingsStorage.getAll();
  
  const settingsMap: Record<string, any> = {};
  
  for (const type of GENERAL_SETTINGS_TYPES) {
    const existing = allSettings.find(s => s.configType === type);
    const labels = GENERAL_SETTINGS_LABELS[type];
    
    settingsMap[type] = {
      config_type: type,
      enabled: existing?.enabled ?? true,
      content: existing?.content ?? "",
      title: labels.title,
      description: labels.description,
      placeholder: labels.placeholder,
      created_at: existing?.createdAt?.toISOString() || null,
      updated_at: existing?.updatedAt?.toISOString() || null,
    };
  }
  
  res.json(settingsMap);
});

router.get("/api/openai-config-general/:configType", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { configType } = req.params;
  
  if (!GENERAL_SETTINGS_TYPES.includes(configType as GeneralSettingType)) {
    return res.status(400).json({ error: `Invalid config type. Must be one of: ${GENERAL_SETTINGS_TYPES.join(", ")}` });
  }
  
  const setting = await generalSettingsStorage.getByType(configType as GeneralSettingType);
  const labels = GENERAL_SETTINGS_LABELS[configType as GeneralSettingType];
  
  res.json({
    config_type: configType,
    enabled: setting?.enabled ?? true,
    content: setting?.content ?? "",
    title: labels.title,
    description: labels.description,
    placeholder: labels.placeholder,
    created_at: setting?.createdAt?.toISOString() || null,
    updated_at: setting?.updatedAt?.toISOString() || null,
  });
});

router.put("/api/openai-config-general/:configType", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { configType } = req.params;
  
  if (!GENERAL_SETTINGS_TYPES.includes(configType as GeneralSettingType)) {
    return res.status(400).json({ error: `Invalid config type. Must be one of: ${GENERAL_SETTINGS_TYPES.join(", ")}` });
  }
  
  const { enabled, content } = req.body;
  
  const setting = await generalSettingsStorage.upsert(configType as GeneralSettingType, {
    enabled: enabled ?? true,
    content: content ?? "",
  });
  
  const labels = GENERAL_SETTINGS_LABELS[configType as GeneralSettingType];
  
  res.json({
    config_type: configType,
    enabled: setting.enabled,
    content: setting.content,
    title: labels.title,
    description: labels.description,
    placeholder: labels.placeholder,
    created_at: setting.createdAt?.toISOString(),
    updated_at: setting.updatedAt?.toISOString(),
  });
});

router.put("/api/openai-config-general", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const updates = req.body;
  
  const results: Record<string, any> = {};
  
  for (const [configType, data] of Object.entries(updates)) {
    if (!GENERAL_SETTINGS_TYPES.includes(configType as GeneralSettingType)) {
      continue;
    }
    
    const { enabled, content } = data as { enabled: boolean; content: string };
    
    const setting = await generalSettingsStorage.upsert(configType as GeneralSettingType, {
      enabled: enabled ?? true,
      content: content ?? "",
    });
    
    const labels = GENERAL_SETTINGS_LABELS[configType as GeneralSettingType];
    
    results[configType] = {
      config_type: configType,
      enabled: setting.enabled,
      content: setting.content,
      title: labels.title,
      description: labels.description,
      placeholder: labels.placeholder,
      created_at: setting.createdAt?.toISOString(),
      updated_at: setting.updatedAt?.toISOString(),
    };
  }
  
  res.json(results);
});

export default router;

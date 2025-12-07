import { summaryStorage } from "./summaryStorage.js";
import { classificationStorage } from "./classificationStorage.js";
import { openaiLogsStorage } from "./openaiLogsStorage.js";

export const configStorage = {
  ...summaryStorage,
  ...classificationStorage,
  ...openaiLogsStorage,
};

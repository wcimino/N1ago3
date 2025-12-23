import { db } from "../../db.js";
import { scArticleProblemSearchApiLog, scSolutionApiLog } from "../../../shared/schema.js";
import type { InsertScArticleProblemSearchApiLog, InsertScSolutionApiLog } from "../../../shared/schema.js";

export const solutionCenterApiLogStorage = {
  async logSearchRequest(data: InsertScArticleProblemSearchApiLog): Promise<number> {
    const [log] = await db.insert(scArticleProblemSearchApiLog)
      .values(data)
      .returning({ id: scArticleProblemSearchApiLog.id });
    return log.id;
  },

  async logSolutionRequest(data: InsertScSolutionApiLog): Promise<number> {
    const [log] = await db.insert(scSolutionApiLog)
      .values(data)
      .returning({ id: scSolutionApiLog.id });
    return log.id;
  },
};

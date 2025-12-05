import { Router, type Request, type Response } from "express";
import { storage } from "../storage.js";
import { isAuthenticated, requireAuthorizedUser } from "../middleware/auth.js";

const router = Router();

router.get('/api/auth/user', isAuthenticated, requireAuthorizedUser, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getAuthUser(userId);
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

router.get("/api/authorized-users", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const users = await storage.getAuthorizedUsers();
  res.json(users);
});

router.post("/api/authorized-users", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const { email, name } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email é obrigatório" });
  }

  const emailLower = email.toLowerCase();
  if (!emailLower.endsWith("@ifood.com.br")) {
    return res.status(400).json({ error: "Email deve ser do domínio @ifood.com.br" });
  }

  try {
    const existingUser = await storage.isUserAuthorized(emailLower);
    if (existingUser) {
      return res.status(409).json({ error: "Usuário já cadastrado" });
    }

    const user = await storage.addAuthorizedUser({
      email: emailLower,
      name,
      createdBy: (req as any).user?.claims?.email,
    });
    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/authorized-users/:id", isAuthenticated, requireAuthorizedUser, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await storage.removeAuthorizedUser(id);
  res.json({ success: true });
});

export default router;

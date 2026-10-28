import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthedRequest extends Request {
  user?: { id: string; role: "interviewer" | "candidate" };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as any;
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export const requireRole = (role: "interviewer" | "candidate") =>
  (req: AuthedRequest, res: Response, next: NextFunction) =>
    req.user?.role === role ? next() : res.status(403).json({ error: "Forbidden" });
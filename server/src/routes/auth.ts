import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prisma";
import crypto from "crypto";
import { env } from "../env";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["interviewer", "candidate"]),
  inviteCode: z.string().max(100).optional(),
});

const sign = (u: { id: string; role: string }) =>
  jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET!, { expiresIn: "7d" });


// Compare secrets without leaking where they differ
const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Used so a login for an unknown email takes as long as one for a known email
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, name, role, inviteCode } = parsed.data;

if (role === "interviewer" && env.INTERVIEWER_INVITE_CODE && !sameSecret(inviteCode ?? "", env.INTERVIEWER_INVITE_CODE))
  return res.status(403).json({ error: "Interviewer accounts need a valid invite code" });
  if (await prisma.user.findUnique({ where: { email } }))
    return res.status(409).json({ error: "Email already registered" });

  const user = await prisma.user.create({
    data: { email, name, role, passwordHash: await bcrypt.hash(password, 10) },
  });
  res.status(201).json({ token: sign(user), user: { id: user.id, name, email, role } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await prisma.user.findUnique({ where: { email: String(email) } });
  // Always run one bcrypt comparison, whether or not the user exists
  const ok = await bcrypt.compare(String(password), user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token: sign(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

export default router;
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .refine((v) => !v.startsWith("change-this"), "JWT_SECRET is still the placeholder value"),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  INTERVIEWER_INVITE_CODE: z.string().min(6).optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;

if (!env.INTERVIEWER_INVITE_CODE)
  console.warn("WARNING: INTERVIEWER_INVITE_CODE is not set. Anyone can register as an interviewer.");
if (!env.GROQ_API_KEY) console.warn("WARNING: GROQ_API_KEY is not set. Scorecards are disabled.");
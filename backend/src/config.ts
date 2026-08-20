import 'dotenv/config';
import { z } from 'zod';

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1'));

/**
 * MOCK_AI lets the whole pipeline run without an Anthropic key — used by tests and
 * as the demo-day fallback when the API is rate limited.
 */
const schema = z.object({
  PORT: z.string().default('4000').transform(Number),
  LOG_LEVEL: z.string().default('info'),

  RPC_URL: z.string().url(),
  RPC_URL_FALLBACK: z.string().url().optional(),
  ORACLE_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'ORACLE_PRIVATE_KEY must be a 32-byte hex key'),

  MOCK_AI: bool(false),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),

  PINATA_GATEWAY: z.string().url().default('https://gateway.pinata.cloud'),
  PINATA_JWT: z.string().optional(),
  OPENWEATHER_KEY: z.string().optional(),

  ADMIN_API_KEY: z.string().optional(),

  // Address overrides; otherwise read from contracts/deployments/sepolia.json.
  CLAIM_REGISTRY_ADDRESS: z.string().optional(),
  POLICY_MANAGER_ADDRESS: z.string().optional(),

  // Block-polling interval for the event listener, in ms.
  POLL_INTERVAL_MS: z.string().default('4000').transform(Number),
  START_BLOCK: z.string().optional().transform((v) => (v ? Number(v) : undefined)),
});

export type Config = z.infer<typeof schema>;

function load(): Config {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  const cfg = parsed.data;
  if (!cfg.MOCK_AI && !cfg.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required unless MOCK_AI=true');
  }
  return cfg;
}

export const config = load();

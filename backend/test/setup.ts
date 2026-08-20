// Minimal env so `config.ts` parses without a live deployment or API keys.
process.env.RPC_URL ??= 'http://127.0.0.1:8545';
process.env.ORACLE_PRIVATE_KEY ??=
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
process.env.MOCK_AI ??= 'true';
process.env.LOG_LEVEL ??= 'silent';
process.env.CLAIM_REGISTRY_ADDRESS ??= '0x0000000000000000000000000000000000000001';
process.env.POLICY_MANAGER_ADDRESS ??= '0x0000000000000000000000000000000000000002';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { http } from 'wagmi';

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY;

/**
 * WalletConnect needs a project id. Without one, RainbowKit still renders and
 * injected wallets (MetaMask) work — only the QR flow is unavailable — so the
 * app stays usable on a preview deploy that has no secrets configured.
 */
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'claimbot-local-dev';

export const wagmiConfig = getDefaultConfig({
  appName: 'ClaimBot',
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(
      alchemyKey ? `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}` : undefined,
    ),
  },
  ssr: true,
});

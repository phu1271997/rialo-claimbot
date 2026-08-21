/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared pipeline ships TypeScript source from the workspace, so Next has
  // to compile it rather than treat it as a prebuilt dependency.
  transpilePackages: ['@claimbot/pipeline'],
  webpack: (config, { webpack }) => {
    // WalletConnect / RainbowKit pull in optional native deps with no browser build.
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // @coinbase/cdp-sdk (reached via RainbowKit's Base Account connector) imports the
    // optional @x402 payment packages. They are not installed, are never reached by
    // this app, and only need to stop breaking the bundle.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));

    // @claimbot/pipeline is ESM TypeScript, so its relative imports carry the
    // ".js" extension that Node requires at runtime. Webpack has to be told those
    // resolve back to the ".ts" sources.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };

    return config;
  },
};

export default nextConfig;

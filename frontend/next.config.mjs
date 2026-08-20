/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    // WalletConnect / RainbowKit pull in optional native deps with no browser build.
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // @coinbase/cdp-sdk (reached via RainbowKit's Base Account connector) imports the
    // optional @x402 payment packages. They are not installed, are never reached by
    // this app, and only need to stop breaking the bundle.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));

    return config;
  },
};

export default nextConfig;

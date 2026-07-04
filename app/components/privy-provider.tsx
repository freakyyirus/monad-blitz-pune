"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { monadTestnet } from "viem/chains";

export default function PrivyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BasePrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || undefined}
      config={{
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false,
        },
        loginMethods: ["wallet", "email"],
        appearance: {
          showWalletLoginFirst: false,
        },
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}

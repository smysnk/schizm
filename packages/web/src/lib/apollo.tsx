"use client";

import { ApolloClient, ApolloProvider, HttpLink, InMemoryCache } from "@apollo/client";
import { useState, type ReactNode } from "react";
import type { PublicRuntimeConfig } from "./runtime-config";

const createApolloClient = (runtimeConfig: PublicRuntimeConfig) =>
  new ApolloClient({
    cache: new InMemoryCache(),
    devtools: {
      enabled: process.env.NODE_ENV !== "production"
    },
    link: new HttpLink({
      uri: runtimeConfig.graphqlEndpoint,
      credentials: "same-origin"
    })
  });

export function ApolloRuntimeProvider({
  children,
  runtimeConfig
}: {
  children: ReactNode;
  runtimeConfig: PublicRuntimeConfig;
}) {
  const [client] = useState(() => createApolloClient(runtimeConfig));

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

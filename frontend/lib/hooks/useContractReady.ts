"use client";

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { isContractReady } from "@/lib/contract/config";
import { ensureContractReady } from "@/lib/contract/schema";

const ContractReadyContext = createContext<boolean | null>(null);

export function ContractReadyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(isContractReady());

  useEffect(() => {
    let live = true;
    void ensureContractReady().then((value) => {
      if (live) setReady(value);
    });
    return () => {
      live = false;
    };
  }, []);

  return createElement(ContractReadyContext.Provider, { value: ready }, children);
}

export function useContractReady(): boolean {
  const ctx = useContext(ContractReadyContext);
  return ctx ?? isContractReady();
}

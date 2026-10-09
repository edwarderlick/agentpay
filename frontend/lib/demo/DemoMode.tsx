"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEMO_STORAGE_KEY } from "../constants";

type DemoContextValue = {
  demoMode: boolean;
  setDemoMode: (value: boolean) => void;
  ready: boolean;
};

const DemoContext = createContext<DemoContextValue | undefined>(undefined);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoModeState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
      setDemoModeState(stored === "true");
    } catch {
      setDemoModeState(false);
    }
    setReady(true);
  }, []);

  const setDemoMode = useCallback((value: boolean) => {
    setDemoModeState(value);
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, value ? "true" : "false");
    } catch {
      /* private mode */
    }
  }, []);

  const value = useMemo(
    () => ({ demoMode, setDemoMode, ready }),
    [demoMode, setDemoMode, ready],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoMode() {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    throw new Error("useDemoMode must be used within DemoModeProvider");
  }
  return ctx;
}

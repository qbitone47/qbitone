"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ScreenId, ScreenParams } from "@/lib/qubit/screens";

interface QubitNavContextValue {
  screen: ScreenId;
  params: ScreenParams;
  navigate: (screen: ScreenId, params?: ScreenParams) => void;
  /** bump to force screens to re-read params (e.g. re-focus same screen) */
  navKey: number;
}

const QubitNavContext = createContext<QubitNavContextValue | null>(null);

export function QubitNavProvider({ initialScreen, children }: { initialScreen: ScreenId; children: React.ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>(initialScreen);
  const [params, setParams] = useState<ScreenParams>({});
  const [navKey, setNavKey] = useState(0);

  const navigate = useCallback((next: ScreenId, nextParams?: ScreenParams) => {
    setScreen(next);
    setParams(nextParams ?? {});
    setNavKey((k) => k + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo(
    () => ({ screen, params, navigate, navKey }),
    [screen, params, navigate, navKey],
  );

  return <QubitNavContext.Provider value={value}>{children}</QubitNavContext.Provider>;
}

export function useQubitNav(): QubitNavContextValue {
  const ctx = useContext(QubitNavContext);
  if (!ctx) throw new Error("useQubitNav must be used inside QubitNavProvider");
  return ctx;
}

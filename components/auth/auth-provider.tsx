"use client";

import { useAuthProvider, AuthContext } from "@/hooks/use-auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { AuthContext: _, ...value } = useAuthProvider();

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

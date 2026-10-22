"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function useClientSession() {
  const [data, setData] = useState(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    let active = true;
    authClient.getSession().then((result) => {
      if (!active) return;
      setData(result.data ?? null);
      setIsPending(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { data, isPending };
}

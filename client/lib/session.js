import "server-only";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export async function getServerSession() {
  const auth = await getAuth();
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getServerUser() {
  const session = await getServerSession();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role || "customer",
  };
}

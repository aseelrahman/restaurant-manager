import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

let cachedHandlers = null;

async function handlers() {
  if (!cachedHandlers) {
    const auth = await getAuth();
    cachedHandlers = toNextJsHandler(auth);
  }
  return cachedHandlers;
}

export async function GET(request) {
  const { GET: handler } = await handlers();
  return handler(request);
}

export async function POST(request) {
  const { POST: handler } = await handlers();
  return handler(request);
}

import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { betterAuth } from "better-auth/minimal";
import { MongoClient } from "mongodb";

const globalAuth = globalThis;

async function createAuthInstance() {
  if (globalAuth.__restaurantAuth) {
    return globalAuth.__restaurantAuth;
  }

  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
  const dbName = process.env.DB_NAME || "restaurant";
  const baseURL =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    console.warn("BETTER_AUTH_SECRET is not set; auth will be unreliable");
  }

  const client = new MongoClient(uri);
  await client.connect();

  const auth = betterAuth({
    secret,
    baseURL,
    trustedOrigins: [baseURL, process.env.CLIENT_ORIGIN].filter(Boolean),
    database: mongodbAdapter(client.db(dbName), { client }),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "customer",
          input: false,
        },
      },
    },
  });

  globalAuth.__restaurantAuth = auth;
  globalAuth.__restaurantAuthMongo = client;
  return auth;
}

/** Lazy singleton — use in route handlers and Express (avoids Mongo at Next build time). */
export async function getAuth() {
  return createAuthInstance();
}

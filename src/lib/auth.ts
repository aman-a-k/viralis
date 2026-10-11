import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import { canCreateAccount } from "./signupPolicy";
import { isLoginBlocked, recordLoginAttempt } from "./rateLimit";

const providers: NextAuthOptions["providers"] = [];

// Google OAuth — only registered when credentials are configured, so a missing
// env var can never crash the NextAuth handler (previously returned HTTP 500).
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("not-a-real-password", 12));

/** Thrown from authorize(); NextAuth passes the message to the sign-in page. */
export const LOGIN_THROTTLED = "TooManyAttempts";

function requestIp(req: unknown): string {
  const headers = (req as { headers?: Record<string, string | string[] | undefined> })?.headers || {};
  const fwd = headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : fwd;
  return (first?.split(",")[0] || (headers["x-real-ip"] as string) || "unknown").trim();
}

// Email + password (works everywhere with no external setup).
providers.push(
  CredentialsProvider({
    id: "credentials",
    name: "Email & Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, req) {
      if (!credentials?.email || !credentials?.password) return null;
      const email = credentials.email.toLowerCase().trim();
      const ip = requestIp(req);

      if (await isLoginBlocked(email, ip)) throw new Error(LOGIN_THROTTLED);

      const user = await prisma.user.findUnique({ where: { email } });
      // Compare against a dummy hash when the account doesn't exist, so
      // response timing doesn't reveal which emails are registered.
      const hash = user?.passwordHash || getDummyHash();
      const valid = await bcrypt.compare(credentials.password, hash);
      await recordLoginAttempt(email, ip, !!(user?.passwordHash && valid));
      if (!user?.passwordHash || !valid) return null;
      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  })
);

// Local development only: one-click sign-in as a seeded dev account. There is
// deliberately no way to turn this on in a production build.
const devLoginEnabled = process.env.NODE_ENV !== "production";

if (devLoginEnabled) {
  providers.push(
    CredentialsProvider({
      id: "dev",
      name: "Developer Bypass",
      credentials: {},
      async authorize() {
        const user = await prisma.user.upsert({
          where: { email: "dev@viralis.local" },
          update: {},
          create: { email: "dev@viralis.local", name: "Dev User", emailVerified: new Date() },
        });
        return { id: user.id, name: user.name, email: user.email, image: null };
      },
    })
  );
}

export const devLoginAvailable = devLoginEnabled;
export const googleLoginAvailable = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  // Credentials providers require the JWT session strategy.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    signIn: async ({ user, account }) => {
      if (account?.provider !== "google") return true;
      const email = user.email?.toLowerCase().trim();
      if (!email) return false;
      const existing = await prisma.user.findUnique({ where: { email } });
      return existing ? true : canCreateAccount(email);
    },
    // Only ever redirect within this site after sign-in/out.
    redirect: async ({ url, baseUrl }) => {
      if (url.startsWith("/") && !url.startsWith("//")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        /* fall through */
      }
      return baseUrl;
    },
    jwt: async ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token?.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  events: {
    // Google has already verified the address; record it so the account can
    // use features gated on a verified email.
    signIn: async ({ user, account, profile }) => {
      if (account?.provider === "google" && user.id && (profile as { email_verified?: boolean })?.email_verified !== false) {
        await prisma.user.updateMany({ where: { id: user.id, emailVerified: null }, data: { emailVerified: new Date() } });
      }
    },
    createUser: async ({ user }) => {
      const { ensurePersonalWorkspace } = await import("./workspace");
      await ensurePersonalWorkspace(user.id, user.name);
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";

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

// Email + password (works everywhere with no external setup).
providers.push(
  CredentialsProvider({
    id: "credentials",
    name: "Email & Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      const email = credentials.email.toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;
      const valid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!valid) return null;
      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  })
);

// Dev-only one-click bypass. Never active in production unless explicitly opted in.
const devLoginEnabled =
  process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_LOGIN === "true";

if (devLoginEnabled) {
  providers.push(
    CredentialsProvider({
      id: "dev",
      name: "Developer Bypass",
      credentials: {},
      // No DB write — works even before a database is connected.
      async authorize() {
        return {
          id: "dev-user",
          name: "Dev User",
          email: "dev@viralis.local",
          image: null,
        };
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
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
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
  pages: {
    signIn: "/auth/signin",
  },
};

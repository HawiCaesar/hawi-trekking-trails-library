import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

declare global {
  var __db__: PrismaClient;
}

if (!global.__db__) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  global.__db__ = new PrismaClient({ adapter });
}

export const db = global.__db__;

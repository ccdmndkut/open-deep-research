"use server";

import { db } from "@/db";
import { auth } from "@clerk/nextjs/server";
import { research as chats } from "@/db/schema";
import { eq } from "drizzle-orm";

export const getChats = async () => {
  const { userId } = await auth();

  if (!userId) {
    return [];
  }

  return await db.query.research.findMany({
    where: eq(chats.clerkUserId, userId),
    orderBy: (chats, { desc }) => [desc(chats.createdAt)],
  });
};

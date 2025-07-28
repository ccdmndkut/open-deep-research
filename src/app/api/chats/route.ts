import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getChats } from "@/lib/getChats";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const chats = await getChats();

  return NextResponse.json(chats);
}

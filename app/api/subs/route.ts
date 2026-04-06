import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Subscription, Category, Rating } from "@/lib/types";
import { randomUUID } from "crypto";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(db.getUserSubs(userId));
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { name: string; price: number; category: Category; rating: Rating; notes?: string };

  if (!body.name || !body.price || !body.category) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const sub: Subscription = {
    id: randomUUID(),
    userId,
    name: body.name.trim(),
    price: Number(body.price),
    category: body.category,
    rating: body.rating ?? "medium",
    notes: body.notes,
    createdAt: new Date().toISOString(),
  };

  const updated = db.addSub(userId, sub);
  return NextResponse.json(updated, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json() as { id: string };
  return NextResponse.json(db.deleteSub(userId, id));
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, ...patch } = await req.json() as { id: string } & Partial<Subscription>;
  return NextResponse.json(db.updateSub(userId, id, patch));
}
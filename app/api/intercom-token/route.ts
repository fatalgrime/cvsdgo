import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import jwt from "jsonwebtoken";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const secret = process.env.INTERCOM_API_SECRET;
    if (!secret) {
      console.error("INTERCOM_API_SECRET environment variable is missing on the server.");
      return NextResponse.json(
        { error: "Intercom server configuration is missing" },
        { status: 500 }
      );
    }

    const email = user.emailAddresses[0]?.emailAddress || "";

    // Construct the payload for Intercom Identity Verification
    const payload = {
      user_id: user.id,
      email: email,
    };

    // Sign the token with the Intercom Messenger API Secret (using HS256)
    const token = jwt.sign(payload, secret, { algorithm: "HS256" });

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Failed to generate Intercom JWT:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

import { auth } from "@clerk/nextjs/server";
import { isAllowedUser, isAdminUser } from "@/lib/access";
import {
  getAllPolicyDocuments,
  hasMeaningfulPolicyContent,
  isPolicyDocumentKey,
  savePolicyDocument,
} from "@/lib/policies";

type PolicyRequestBody = {
  documentKey?: unknown;
  markdown?: unknown;
};

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const allowed = await isAllowedUser(userId);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const canEditPolicies = await isAdminUser(userId);
  const documents = await getAllPolicyDocuments();

  return Response.json({
    canEditPolicies,
    storageAvailable: Boolean(process.env.DATABASE_URL),
    documents,
  });
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const allowed = await isAdminUser(userId);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const body = (await request.json().catch(() => null)) as PolicyRequestBody | null;
  const documentKey = String(body?.documentKey ?? "").trim();
  const markdown = String(body?.markdown ?? "").replace(/\r\n/g, "\n");

  if (!isPolicyDocumentKey(documentKey)) {
    return new Response("Invalid policy document", { status: 400 });
  }

  if (!hasMeaningfulPolicyContent(markdown)) {
    return new Response("Policy content cannot be empty.", { status: 400 });
  }

  try {
    const savedDocument = await savePolicyDocument({
      key: documentKey,
      markdown,
      actorUserId: userId,
      request,
    });

    return Response.json({
      ok: true,
      document: savedDocument,
    });
  } catch (error) {
    const message = (error as Error).message || "Unable to save policy document.";
    return new Response(message, { status: 400 });
  }
}

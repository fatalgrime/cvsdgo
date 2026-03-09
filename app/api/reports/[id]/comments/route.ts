import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { isReportStaffUser } from "@/lib/access";

type ReportCommentInsertRow = {
  id: number;
  report_id: number;
  author_user_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasDatabaseUrl()) {
    return new Response("Database not configured", { status: 500 });
  }

  const isStaff = await isReportStaffUser(userId);
  if (!isStaff) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const comment = String(body.comment ?? "").trim();
  if (!comment) {
    return new Response("Comment is required", { status: 400 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const authorName = user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Staff";

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO report_comments (report_id, author_user_id, author_name, body)
    VALUES (${id}, ${userId}, ${authorName}, ${comment})
    RETURNING id, report_id, author_user_id, author_name, body, created_at;
  `) as ReportCommentInsertRow[];

  return Response.json({ comment: rows[0] }, { status: 201 });
}

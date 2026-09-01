import { auth } from "@clerk/nextjs/server";
import { getAccessProfile } from "@/lib/access";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureQrSchema } from "@/lib/qr-schema";
import { ensureReportSchema } from "@/lib/report-schema";

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId || !hasDatabaseUrl()) {
    return Response.json({ count: 0, pendingQrCount: 0, openReportsCount: 0 });
  }

  const profile = await getAccessProfile(userId);
  const isStaff = profile.admin || profile.reportStaff || profile.canManageLinks || profile.canManageReports;

  try {
    const sql = getSql();
    await Promise.all([ensureQrSchema(), ensureReportSchema()]);

    if (isStaff) {
      // Staff/Admins see all pending QR requests + open/investigating problem reports
      const [qrRows, reportRows] = await Promise.all([
        sql`SELECT COUNT(*)::int AS count FROM qr_code_requests WHERE status = 'pending';`,
        sql`SELECT COUNT(*)::int AS count FROM reports WHERE status IN ('open', 'investigating');`,
      ]);

      const pendingQrCount = (qrRows as Array<{ count: number }>)[0]?.count ?? 0;
      const openReportsCount = (reportRows as Array<{ count: number }>)[0]?.count ?? 0;
      const count = pendingQrCount + openReportsCount;

      return Response.json({ count, pendingQrCount, openReportsCount, isStaff: true });
    } else {
      // Regular users see their open reports & pending QR requests
      const [qrRows, reportRows] = await Promise.all([
        sql`SELECT COUNT(*)::int AS count FROM qr_code_requests WHERE user_id = ${userId} AND status = 'pending';`,
        sql`SELECT COUNT(*)::int AS count FROM reports WHERE user_id = ${userId} AND status IN ('open', 'investigating');`,
      ]);

      const pendingQrCount = (qrRows as Array<{ count: number }>)[0]?.count ?? 0;
      const openReportsCount = (reportRows as Array<{ count: number }>)[0]?.count ?? 0;
      const count = pendingQrCount + openReportsCount;

      return Response.json({ count, pendingQrCount, openReportsCount, isStaff: false });
    }
  } catch (error) {
    console.error("Error fetching submissions count:", error);
    return Response.json({ count: 0, pendingQrCount: 0, openReportsCount: 0 });
  }
}

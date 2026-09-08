import { prisma } from "@/lib/db";

// The verify_email template shipped with {{verifyUrl}} (old link-based design),
// but the signup code sends { otp }. The variable mismatch makes renderTemplate
// throw, and signup swallows the error — so no verification email is ever sent.
// This rewrites verify_email to an OTP-based template matching the code.

const VERIFY_EMAIL_BODY = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verify your email</title></head>
<body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td align="center" style="padding-bottom:32px;">
            <div style="display:inline-block;background:linear-gradient(37.7deg,#c87a02 21%,#210102 86%);border-radius:16px;padding:14px 28px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;">SOPHIONIX</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:rgba(26,1,1,0.95);border:1px solid rgba(255,255,255,0.12);border-radius:21px;padding:48px 40px;">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#ffffff;text-align:center;">Verify your email</h1>
            <p style="margin:0 0 32px;font-size:15px;color:rgba(255,255,255,0.65);text-align:center;line-height:1.6;">
              Enter the verification code below to activate your Sophionix account.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:32px;">
              <div style="display:inline-block;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:18px 36px;">
                <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:#ffffff;">{{otp}}</span>
              </div>
            </td></tr></table>
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="border-top:1px solid rgba(255,255,255,0.1);padding-top:24px;">
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.4);text-align:center;line-height:1.6;">
                  This code expires in 24 hours. If you didn't create a Sophionix account, you can safely ignore this email.
                </p>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:24px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
              &copy; Sophionix. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// What each template's code path actually passes as vars. A template whose
// declared variables aren't all supplied makes renderTemplate throw.
const EXPECTED_VARS: Record<string, string[]> = {
  verify_email: ["otp"],
  reset_password: ["otp"],
  admin_invite: ["inviteUrl", "fullName", "role"],
  admin_reset_password: ["resetUrl", "fullName"],
};

async function main() {
  // 1) Fix the known-broken verify_email template (verifyUrl -> otp).
  const updated = await prisma.notificationTemplate.update({
    where: { slug: "verify_email" },
    data: {
      subject: "Verify your Sophionix account",
      body: VERIFY_EMAIL_BODY,
      variables: ["otp"],
    },
    select: { slug: true, variables: true },
  });
  console.log("verify_email updated:", JSON.stringify(updated));

  // 2) Audit every email template for a declared-var / code-var mismatch, so we
  //    catch any other silently-failing template (admin invite/reset, etc.).
  console.log("\n=== template var audit ===");
  const all = await prisma.notificationTemplate.findMany({
    where: { type: "EMAIL" },
    select: { slug: true, body: true, variables: true },
  });
  for (const t of all) {
    const declared = Array.isArray(t.variables)
      ? (t.variables as unknown[]).filter((v): v is string => typeof v === "string")
      : [];
    const supplied = EXPECTED_VARS[t.slug];
    const placeholders = [
      ...new Set(
        [...t.body.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)].map((m) => m[1]),
      ),
    ];
    // A template renders OK only if every declared variable is supplied by code.
    const missing = supplied
      ? declared.filter((d) => !supplied.includes(d))
      : null;
    const status =
      supplied == null
        ? "NO CODE PATH (not sent by app)"
        : missing && missing.length
          ? `BROKEN — declares ${JSON.stringify(missing)} the code never sends`
          : "OK";
    console.log(
      `${t.slug}: ${status} | declared=${JSON.stringify(declared)} placeholders=${JSON.stringify(placeholders)} codeSends=${JSON.stringify(supplied ?? [])}`,
    );
  }
  await prisma.$disconnect();
}

main();

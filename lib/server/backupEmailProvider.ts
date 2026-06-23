import "server-only";
import { FROM_EMAIL } from "@/lib/emailConfig";

type EmailOptions = {
  to: string;
  subject: string;
  html: string;
};

const BACKUP_API_KEY = process.env.BACKUP_EMAIL_API_KEY || process.env.RESEND_API_KEY || "";

export async function tryBackupProvider({ to, subject, html }: EmailOptions): Promise<boolean> {
  if (!BACKUP_API_KEY) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BACKUP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[backupEmail] Resend error:", res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[backupEmail] fetch error:", err);
    return false;
  }
}

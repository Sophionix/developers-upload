import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { renderTemplate, TemplateRenderError } from "@/emails/render";

export class MailerError extends Error {
  readonly code = "MAILER_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "MailerError";
  }
}

export { TemplateRenderError };

export interface SendEmailInput {
  to: string;
  templateKey: string;
  vars: Record<string, string | number>;
}

let cachedTransport: Transporter | undefined;

function looksLikePlaceholder(value: string): boolean {
  return /CHANGE_ME/i.test(value);
}

function buildTransport(): Transporter {
  if (env.MAILER_TRANSPORT === "stream") {
    return nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    });
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    pool: true,
    maxConnections: 5,
  });
}

function getTransport(): Transporter {
  cachedTransport ??= buildTransport();
  return cachedTransport;
}

function isConfigured(): boolean {
  if (env.MAILER_TRANSPORT === "stream") return true;
  if (!env.SMTP_HOST || !env.SMTP_USER) return false;
  return !looksLikePlaceholder(env.SMTP_HOST) &&
    !looksLikePlaceholder(env.SMTP_USER);
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<{ messageId: string }> {
  if (!isConfigured()) {
    logger.warn({ templateKey: input.templateKey }, "mailer_skipped_not_configured");
    throw new MailerError("mailer_not_configured");
  }

  const tpl = await prisma.notificationTemplate.findUnique({
    where: { slug: input.templateKey },
    select: { subject: true, body: true, variables: true, type: true },
  });
  if (!tpl) throw new MailerError(`template_not_found:${input.templateKey}`);
  if (tpl.type !== "EMAIL") throw new MailerError("template_not_email");

  const declared = Array.isArray(tpl.variables)
    ? (tpl.variables as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];

  const subjectTpl = tpl.subject ?? "";
  const subject = renderTemplate(subjectTpl, input.vars, declared);
  const body = renderTemplate(tpl.body, input.vars, declared);

  try {
    const info = await getTransport().sendMail({
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO,
      to: input.to,
      subject,
      html: body,
    });
    return { messageId: info.messageId };
  } catch (err) {
    logger.error({ err, templateKey: input.templateKey }, "mailer_send_failed");
    throw new MailerError(err instanceof Error ? err.message : "send_failed");
  }
}

export type NotifyResult = {
  ok: boolean;
  mock?: boolean;
  id?: string;
  error?: string;
};

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<NotifyResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "KS Abroad <onboarding@resend.dev>";

  if (!key) {
    console.info("[notify:email:mock]", input.to, input.subject, input.text.slice(0, 120));
    return { ok: true, mock: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    const json = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: json.message || `Resend ${res.status}` };
    }
    return { ok: true, id: json.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email failed" };
  }
}

export async function sendSms(input: { to: string; body: string }): Promise<NotifyResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || !from) {
    console.info("[notify:sms:mock]", input.to, input.body.slice(0, 120));
    return { ok: true, mock: true };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: input.to, From: from, Body: input.body }),
    });
    const json = (await res.json()) as { sid?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: json.message || `Twilio ${res.status}` };
    }
    return { ok: true, id: json.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "SMS failed" };
  }
}

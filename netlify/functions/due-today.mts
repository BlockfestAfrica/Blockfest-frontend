/**
 * The morning list, on a timer: 07:00 UTC, which is 08:00 in Lagos.
 *
 * Only asks the app; app/api/cron/due-today decides what is due and emails
 * owners. Nothing goes to creators from here. Netlify runs scheduled
 * functions on published production deploys only, so previews never send.
 */
export default async () => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("due-today: CRON_SECRET is not set; nothing sent");
    return;
  }
  const base = (process.env.URL ?? "https://blockfestafrica.com").replace(/\/$/, "");
  const response = await fetch(`${base}/api/cron/due-today`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  console.log(`due-today: ${response.status} ${await response.text()}`);
};

export const config = { schedule: "0 7 * * *" };

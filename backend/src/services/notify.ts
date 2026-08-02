import { NotifChannel, NotifStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { emit, emitTo } from '../lib/realtime';

interface Outgoing {
  subject: string;
  body: string;
  refType?: string;
  refId?: string;
  /** Extra recipients beyond on-duty staff, e.g. the hiker's emergency contact. */
  extraPhones?: string[];
}

const STAFF_ROLES: Role[] = [Role.ADMIN, Role.RANGER, Role.OFFICER];

/**
 * Sends through whichever channel is configured. Nothing is silently dropped:
 * when no provider is set up the row is stored as SKIPPED with the reason, so
 * the park manager can still see what the system tried to send.
 */
async function dispatch(id: string, channel: NotifChannel, target: string, subject: string, body: string) {
  const fail = (error: string, status: NotifStatus = NotifStatus.FAILED) =>
    prisma.notification.update({
      where: { id },
      data: { status, error, attempts: { increment: 1 } },
    });

  try {
    if (channel === NotifChannel.WHATSAPP) {
      const token = process.env.FONNTE_TOKEN;
      if (!token) return fail('FONNTE_TOKEN belum diset', NotifStatus.SKIPPED);

      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, message: `*${subject}*\n\n${body}` }),
      });
      if (!res.ok) return fail(`Fonnte HTTP ${res.status}`);
    }

    if (channel === NotifChannel.WEBHOOK) {
      const res = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, at: new Date().toISOString() }),
      });
      if (!res.ok) return fail(`Webhook HTTP ${res.status}`);
    }

    return prisma.notification.update({
      where: { id },
      data: { status: NotifStatus.SENT, sentAt: new Date(), attempts: { increment: 1 } },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal mengirim');
  }
}

export async function notifyStaff(msg: Outgoing) {
  const staff = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES }, isActive: true },
    select: { phone: true },
  });

  const phones = Array.from(
    new Set([...staff.map((s) => s.phone), ...(msg.extraPhones ?? [])].filter(Boolean))
  );

  const targets: { channel: NotifChannel; target: string }[] = phones.map((phone) => ({
    channel: NotifChannel.WHATSAPP,
    target: phone,
  }));

  const hook = process.env.SOS_WEBHOOK_URL;
  if (hook) targets.push({ channel: NotifChannel.WEBHOOK, target: hook });

  const created = await Promise.all(
    targets.map((t) =>
      prisma.notification.create({
        data: {
          channel: t.channel,
          target: t.target,
          subject: msg.subject,
          body: msg.body,
          refType: msg.refType,
          refId: msg.refId,
        },
      })
    )
  );

  // The operator console gets the alert instantly regardless of outbound channels.
  emit('notification:new', { subject: msg.subject, body: msg.body, refType: msg.refType, refId: msg.refId });

  await Promise.all(
    created.map((n) => dispatch(n.id, n.channel, n.target, msg.subject, msg.body))
  );

  return created.length;
}

/** Mengirim pesan ke kotak masuk pendaki di dalam aplikasi. */
export async function notifyUser(
  userId: string,
  msg: { subject: string; body: string; refType?: string; refId?: string }
) {
  const row = await prisma.notification.create({
    data: {
      channel: NotifChannel.INAPP,
      userId,
      target: userId,
      subject: msg.subject,
      body: msg.body,
      refType: msg.refType,
      refId: msg.refId,
      status: NotifStatus.PENDING,
    },
  });
  emitTo(`user:${userId}`, 'inbox:new', { id: row.id, subject: msg.subject });
  return row;
}

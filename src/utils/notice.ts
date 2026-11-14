import {
  AlertTriangle,
  Bell,
  CalendarEvent,
  Clock,
  Download,
  Gift,
  Headset,
  ReceiptRefund,
  ShieldLock,
  Ticket,
  Users,
} from '@vicons/tabler'
import type { Component } from 'vue'

export type NoticeTone = 'good' | 'warn' | 'bad' | 'info'
export interface NoticeMeta {
  icon: Component
  tone: NoticeTone
  /** Nama rute tujuan saat notifikasi diklik. */
  route: string
}

// Templat BE -> ikon, nada, dan tujuan. Templat baru yang belum terdaftar jatuh ke bel biasa.
const META: Record<string, NoticeMeta> = {
  order_paid: { icon: Ticket, tone: 'good', route: 'tickets' },
  ticket_received: { icon: Ticket, tone: 'good', route: 'tickets' },
  ticket_claim: { icon: Gift, tone: 'info', route: 'tickets' },
  comp_ticket: { icon: Gift, tone: 'good', route: 'tickets' },
  order_expired: { icon: Clock, tone: 'warn', route: 'orders' },
  refund_update: { icon: ReceiptRefund, tone: 'info', route: 'refunds' },
  refund_account_needed: { icon: ReceiptRefund, tone: 'warn', route: 'refunds' },
  event_cancelled: { icon: AlertTriangle, tone: 'bad', route: 'refunds' },
  reminder_event: { icon: CalendarEvent, tone: 'info', route: 'tickets' },
  reminder_onsale: { icon: CalendarEvent, tone: 'info', route: 'events' },
  waitlist_offer: { icon: Clock, tone: 'warn', route: 'events' },
  follow_new_event: { icon: Bell, tone: 'info', route: 'events' },
  squad_invite: { icon: Users, tone: 'info', route: 'tickets' },
  resale_sold: { icon: Ticket, tone: 'good', route: 'tickets' },
  support_received: { icon: Headset, tone: 'info', route: 'help' },
  support_reply: { icon: Headset, tone: 'info', route: 'help' },
  export_ready: { icon: Download, tone: 'good', route: 'privacy' },
  password_changed: { icon: ShieldLock, tone: 'warn', route: 'security' },
  email_change_notice: { icon: ShieldLock, tone: 'warn', route: 'security' },
}
export function noticeMeta(template: string): NoticeMeta {
  return META[template] ?? { icon: Bell, tone: 'info', route: 'notifications' }
}

/** "3 mnt lalu", "kemarin", ... memakai Intl.RelativeTimeFormat. */
export function timeAgo(iso: string, bcp: string, now = Date.now()): string {
  const s = Math.round((new Date(iso).getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(bcp, { numeric: 'auto' })
  const abs = Math.abs(s)
  if (abs < 60) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day')
  return new Intl.DateTimeFormat(bcp, { dateStyle: 'medium' }).format(new Date(iso))
}

import { connect } from "cloudflare:sockets";
import PostalMime, { type Email } from "postal-mime";

const encode = new TextEncoder(), decode = new TextDecoder();
const MAX_MESSAGE = 2 * 1024 * 1024;
type ResponsePart = { line: string; literal?: Uint8Array };
export class InboxError extends Error {
  constructor(public readonly kind: "connection" | "authentication" | "stale" | "missing" | "large") { super(kind); }
}

// Deliberately limited to read-only INBOX commands, with byte-counted literals.
export class InboxConnection {
  private socket = connect({ hostname: "imap.qiye.aliyun.com", port: 993 }, { secureTransport: "on", allowHalfOpen: false });
  private reader = this.socket.readable.getReader();
  private writer = this.socket.writable.getWriter();
  private buffer = new Uint8Array(0);
  private tag = 0;
  private timer = setTimeout(() => { void this.socket.close().catch(() => {}); }, 30000);
  private async fill() {
    const { value, done } = await this.reader.read();
    if (done || !value) throw new InboxError("connection");
    if (this.buffer.length + value.length > MAX_MESSAGE + 65536) throw new InboxError("large");
    const next = new Uint8Array(this.buffer.length + value.length);
    next.set(this.buffer); next.set(value, this.buffer.length); this.buffer = next;
  }
  private async line() {
    for (;;) {
      const index = this.buffer.findIndex((value, index) => value === 13 && this.buffer[index + 1] === 10);
      if (index >= 0) { const line = decode.decode(this.buffer.subarray(0, index)); this.buffer = this.buffer.slice(index + 2); return line; }
      if (this.buffer.length > 65536) throw new InboxError("large");
      await this.fill();
    }
  }
  private async literal(length: number) {
    if (length > MAX_MESSAGE) throw new InboxError("large");
    while (this.buffer.length < length) await this.fill();
    const bytes = this.buffer.slice(0, length); this.buffer = this.buffer.slice(length); return bytes;
  }
  async command(command: string) {
    const tag = `A${++this.tag}`;
    await this.writer.write(encode.encode(`${tag} ${command}\r\n`));
    const parts: ResponsePart[] = [];
    let received = 0;
    for (;;) {
      const line = await this.line(); received += line.length;
      if (received > MAX_MESSAGE + 65536 || parts.length > 2000) throw new InboxError("large");
      if (line.startsWith(`${tag} `)) {
        if (!line.startsWith(`${tag} OK`)) throw new InboxError(command.startsWith("LOGIN ") ? "authentication" : "connection");
        return parts;
      }
      if (/^\* BYE/i.test(line)) throw new InboxError("connection");
      const count = /\{(\d+)\}\s*$/.exec(line);
      const bytes = count ? await this.literal(Number(count[1])) : undefined;
      received += bytes?.length || 0;
      if (received > MAX_MESSAGE + 65536) throw new InboxError("large");
      parts.push({ line, literal: bytes });
    }
  }
  async open(password: string) {
    if (!/^\* OK\b/i.test(await this.line())) throw new InboxError("connection");
    if (!password || /[\r\n\0]/.test(password)) throw new InboxError("authentication");
    const escaped = password.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    await this.command(`LOGIN "server@firstlooklab.cn" "${escaped}"`);
    const parts = await this.command("EXAMINE INBOX");
    const response = parts.map(part => part.line).join("\n");
    const validity = /\[UIDVALIDITY (\d+)\]/i.exec(response)?.[1];
    if (!validity) throw new InboxError("connection");
    return { validity, total: Number(/\* (\d+) EXISTS/i.exec(response)?.[1] || 0) };
  }
  async close() {
    clearTimeout(this.timer);
    this.reader.releaseLock(); this.writer.releaseLock();
    await this.socket.close().catch(() => {});
  }
}

function fetchRecords(parts: ResponsePart[]) {
  const records: { metadata: string; raw?: Uint8Array }[] = [];
  let current: { metadata: string; raw?: Uint8Array } | undefined;
  for (const part of parts) {
    if (/^\* \d+ FETCH \(/i.test(part.line)) { current = { metadata: part.line }; records.push(current); }
    else if (current) current.metadata += ` ${part.line}`;
    if (current && part.literal) current.raw = part.literal;
  }
  return records;
}

const parserOptions = { maxNestingDepth: 30, maxHeadersSize: 65536, forceRfc822Attachments: true, maxRfc822NestingDepth: 2 };
function summary(email: Email) {
  return { subject: email.subject || "（无主题）", from: email.from?.name || email.from?.address || "未知发件人", fromAddress: email.from?.address || "", date: email.date || "" };
}
// HTML never enters the DOM: text-only fallback also blocks trackers and scripts.
export function htmlText(html: string) {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(?:br|\/p|\/div|\/tr|\/li|\/h[1-6])\b[^>]*>/gi, "\n").replace(/<[^>]*>/g, "")
    .replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi, (match, decimal, hex, name) => {
      if (name) return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[name.toLowerCase()];
      const value = Number.parseInt(decimal || hex, decimal ? 10 : 16);
      return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match;
    }).trim();
}
export async function listInbox(password: string, page: number) {
  const connection = new InboxConnection();
  try {
    const { validity, total } = await connection.open(password);
    const end = total - (page - 1) * 20, start = Math.max(1, end - 19);
    if (end < 1) return { messages: [], total, hasMore: false };
    const parts = await connection.command(`FETCH ${start}:${end} (UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`);
    const messages = [];
    for (const record of fetchRecords(parts)) {
      const uid = /\bUID (\d+)\b/i.exec(record.metadata)?.[1];
      if (!uid || !record.raw) continue;
      const email = await PostalMime.parse(record.raw, parserOptions);
      messages.push({ id: `${validity}:${uid}`, ...summary(email), unread: !/\\Seen\b/i.test(record.metadata) });
    }
    messages.reverse();
    return { messages, total, hasMore: start > 1 };
  } finally { await connection.close(); }
}
export async function readInbox(password: string, id: string) {
  const [validity, uid] = id.split(":");
  if (!/^\d{1,10}:\d{1,10}$/.test(id)) throw new InboxError("missing");
  const connection = new InboxConnection();
  try {
    const selected = await connection.open(password);
    if (selected.validity !== validity) throw new InboxError("stale");
    const size = await connection.command(`UID FETCH ${uid} (UID RFC822.SIZE)`);
    const metadata = size.map(part => part.line).join(" ");
    const length = /RFC822.SIZE (\d+)/i.exec(metadata)?.[1];
    if (!length || !new RegExp(`\\bUID ${uid}\\b`).test(metadata)) throw new InboxError("missing");
    if (Number(length) > MAX_MESSAGE) throw new InboxError("large");
    const parts = await connection.command(`UID FETCH ${uid} (UID BODY.PEEK[])`);
    const record = fetchRecords(parts).find(record => new RegExp(`\\bUID ${uid}\\b`).test(record.metadata));
    if (!record?.raw) throw new InboxError("missing");
    const email = await PostalMime.parse(record.raw, parserOptions);
    const replyTo = email.replyTo?.[0]?.address || email.from?.address || "";
    return { id, ...summary(email), replyTo, text: email.text || htmlText(email.html || ""),
      attachments: email.attachments.map(item => item.filename || "未命名附件"),
      messageId: email.messageId || "", references: email.references || "" };
  } finally { await connection.close(); }
}

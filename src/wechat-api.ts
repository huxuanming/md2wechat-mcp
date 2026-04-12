import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

const WECHAT_BASE = "https://api.weixin.qq.com";
const DEFAULT_WECHAT_TIMEOUT_MS = 15000;

function getWechatTimeoutMs(): number {
  const raw = process.env.WECHAT_API_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_WECHAT_TIMEOUT_MS;
}

export interface WechatArticle {
  article_type?: "news" | "newspic";
  title: string;
  author?: string;
  digest?: string;
  content: string;
  content_source_url?: string;
  thumb_media_id?: string;
  need_open_comment?: 0 | 1;
  only_fans_can_comment?: 0 | 1;
}

async function wechatFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = getWechatTimeoutMs();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`WeChat API request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const data = (await res.json()) as T & { errcode?: number; errmsg?: string };
  if (typeof data.errcode === "number" && data.errcode !== 0) {
    throw new Error(`WeChat API error ${data.errcode}: ${data.errmsg ?? "unknown"}`);
  }
  return data;
}

export async function getAccessToken(appid: string, secret: string): Promise<{ access_token: string; expires_in: number }> {
  const url = `${WECHAT_BASE}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`;
  return wechatFetch(url);
}

export async function draftAdd(accessToken: string, articles: WechatArticle[]): Promise<{ media_id: string }> {
  const url = `${WECHAT_BASE}/cgi-bin/draft/add?access_token=${encodeURIComponent(accessToken)}`;
  return wechatFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ articles })
  });
}

export async function draftUpdate(accessToken: string, mediaId: string, index: number, article: WechatArticle): Promise<{ errcode: number; errmsg: string }> {
  const url = `${WECHAT_BASE}/cgi-bin/draft/update?access_token=${encodeURIComponent(accessToken)}`;
  return wechatFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ media_id: mediaId, index, articles: article })
  });
}

export interface DraftNewsItem {
  article_type: "news" | "newspic";
  title: string;
  author: string;
  digest: string;
  content: string;
  content_source_url: string;
  thumb_media_id: string;
  need_open_comment: number;
  only_fans_can_comment: number;
  url: string;
}

export interface DraftItem {
  media_id: string;
  content: { news_item: DraftNewsItem[] };
  update_time: number;
}

export interface DraftBatchGetResult {
  total_count: number;
  item_count: number;
  item: DraftItem[];
}

export async function draftBatchGet(accessToken: string, offset: number, count: number, noContent?: 0 | 1): Promise<DraftBatchGetResult> {
  const url = `${WECHAT_BASE}/cgi-bin/draft/batchget?access_token=${encodeURIComponent(accessToken)}`;
  return wechatFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ offset, count, no_content: noContent ?? 0 })
  });
}

export async function uploadImage(accessToken: string, filePath: string): Promise<{ url: string }> {
  const url = `${WECHAT_BASE}/cgi-bin/media/uploadimg?access_token=${encodeURIComponent(accessToken)}`;
  const fileBuffer = await readFile(filePath);
  const ext = extname(filePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  const form = new FormData();
  form.append("media", new Blob([fileBuffer], { type: mimeType }), basename(filePath));
  return wechatFetch(url, { method: "POST", body: form });
}

export type PermanentMaterialType = "image" | "voice" | "video" | "thumb";

export interface MaterialDescription {
  title?: string;
  introduction?: string;
}

export interface AddMaterialResult {
  media_id: string;
  url?: string;
}

function getMimeTypeByExtension(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".mp3": "audio/mpeg",
    ".wma": "audio/x-ms-wma",
    ".wav": "audio/wav",
    ".amr": "audio/amr",
    ".mp4": "video/mp4"
  };
  return map[ext] ?? "application/octet-stream";
}

export async function addMaterial(
  accessToken: string,
  type: PermanentMaterialType,
  filePath: string,
  description?: MaterialDescription
): Promise<AddMaterialResult> {
  const url = `${WECHAT_BASE}/cgi-bin/material/add_material?access_token=${encodeURIComponent(accessToken)}&type=${encodeURIComponent(type)}`;
  const fileBuffer = await readFile(filePath);
  const form = new FormData();
  form.append("media", new Blob([fileBuffer], { type: getMimeTypeByExtension(filePath) }), basename(filePath));

  if (type === "video" && description) {
    form.append("description", JSON.stringify(description));
  }

  return wechatFetch(url, { method: "POST", body: form });
}

export async function draftDelete(accessToken: string, mediaId: string): Promise<{ errcode: number; errmsg: string }> {
  const url = `${WECHAT_BASE}/cgi-bin/draft/delete?access_token=${encodeURIComponent(accessToken)}`;
  return wechatFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ media_id: mediaId })
  });
}

/* =========================================================================
 * 个人成长工作台 · 云端推送服务（Cloudflare Worker）
 * -------------------------------------------------------------------------
 * 功能：
 *  1. 接收前端上传的 Push 订阅与提醒配置（KV 存储）
 *  2. Cron 定时（每分钟）检查每个用户的饮水/久坐提醒条件，到点通过
 *     Web Push 协议推送——手机锁屏 / 页面不打开也能收到（手表同步震动）
 * 部署：见 README-云端推送.md（创建 Worker + KV 绑定 PUSH_KV + 配置 VAPID）
 * ========================================================================= */

/* ---------------- 配置（部署时替换成你的 VAPID 密钥） ---------------- */
const VAPID_PUBLIC = "BM0xMytwzPRCfi9kfFJv4S8dPJ-0sAeIfTCM6mxj8PFBHBNn8HC1tFHj8MFXb2Mtl9bkO3yUPkX_eAfKlAtiqag";
const VAPID_PRIVATE = "rgBySrh227GM2NqlTEl-ZokzVTyKmpmeJjMtO_IN-C0";
const VAPID_SUBJECT = "mailto:admin@example.com"; // 推送用途说明邮箱，可随意改

/* ---------------- KV 绑定：PUSH_KV ---------------- */
/* 每个用户一条记录：
   key = "u:" + userId
   value = {
     sub:   { endpoint, keys: { p256dh, auth } },   // 浏览器 Push 订阅
     cfg:   { waterReminder, waterInterval, waterStart, waterEnd,
              sitReminder, sitInterval, lastWater, lastSit, tzOffset },
     updatedAt: 时间戳
   } */

/* ================= Web Push 协议实现（RFC 8291 aes128gcm） ================= */

function b64ToU8(b64) {
  const s = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function u8ToB64(u8) {
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function hkdf(ikm, salt, info, len) {
  return crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"])
    .then(key => crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8))
    .then(buf => new Uint8Array(buf));
}
function ecdhDerive(privJwk, publicPoint) {
  return crypto.subtle.importKey("raw", publicPoint, { name: "ECDH", namedCurve: "P-256" }, false, [])
    .then(pub => crypto.subtle.importKey("jwk", privJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"])
      .then(priv => crypto.subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256)))
    .then(buf => new Uint8Array(buf));
}
function aes128gcmEncrypt(key, nonce, data) {
  return crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt"])
    .then(k => crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, data))
    .then(buf => new Uint8Array(buf));
}
async function ecdsaSign(jwkKey, data) {
  const key = await crypto.subtle.importKey("jwk", jwkKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  return new Uint8Array(sig); // WebCrypto 返回 ASN.1 DER 编码，需转 raw r||s
}
/* ASN.1 DER ECDSA 签名 → raw 64 字节 (r||s) */
function derToRaw(der) {
  let offset = 2;
  const readInt = () => {
    let len = der[offset + 1], start = offset + 2;
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = len * 256 + der[start + i]; start += n; }
    while (der[start] === 0) { start++; len--; }
    const out = new Uint8Array(32);
    const copyLen = Math.min(len, 32);
    for (let i = 0; i < copyLen; i++) out[32 - copyLen + i] = der[start + i];
    offset = start + len;
    return out;
  };
  if (der[0] !== 0x30) throw new Error("bad der");
  const r = readInt(), s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0); raw.set(s, 32);
  return raw;
}

async function sendWebPush(sub, payloadText) {
  const endpoint = new URL(sub.endpoint);
  const uaPub = b64ToU8(sub.keys.p256dh);
  const authSecret = b64ToU8(sub.keys.auth);

  /* VAPID JWT（ES256） */
  const header = u8ToB64(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const now = Math.floor(Date.now() / 1000);
  const claims = u8ToB64(new TextEncoder().encode(JSON.stringify({ aud: endpoint.origin, exp: now + 12 * 3600, sub: VAPID_SUBJECT })));
  const pubPoint = b64ToU8(VAPID_PUBLIC); // 65B: 0x04 || x || y
  const jwk = {
    kty: "EC", crv: "P-256",
    x: u8ToB64(pubPoint.subarray(1, 33)),
    y: u8ToB64(pubPoint.subarray(33, 65)),
    d: VAPID_PRIVATE,
  };
  const jwtBody = header + "." + claims;
  const der = await ecdsaSign(jwk, new TextEncoder().encode(jwtBody));
  const raw = derToRaw(der);
  const signature = u8ToB64(raw);
  const jwt = jwtBody + "." + signature;

  /* 推送加密（RFC 8291 aes128gcm） */
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const ephJwk = await crypto.subtle.exportKey("jwk", eph.privateKey);
  const ephPub = await crypto.subtle.exportKey("raw", eph.publicKey); // 65B

  const shared = await ecdhDerive(ephJwk, uaPub);
  const prk = await hkdf(shared, authSecret, new Uint8Array(0), 32); // extract
  const keyInfo = concatU8(new TextEncoder().encode("WebPush: info"), new Uint8Array([0]), uaPub, ephPub);
  const ikm = await hkdf(prk, new Uint8Array(0), keyInfo, 32);
  const cek = await hkdf(ikm, new Uint8Array(0), new TextEncoder().encode("Content-Encoding: aes128gcm\x00"), 16);
  const nonce = await hkdf(ikm, new Uint8Array(0), new TextEncoder().encode("Content-Encoding: nonce\x00"), 12);

  const RECORD_SIZE = 4096;
  const pad = new Uint8Array(2); // 2 字节 pad 长度 = 0
  const plain = concatU8(pad, new TextEncoder().encode(payloadText));
  const rsBytes = new Uint8Array([(RECORD_SIZE >>> 24) & 0xff, (RECORD_SIZE >>> 16) & 0xff, (RECORD_SIZE >>> 8) & 0xff, RECORD_SIZE & 0xff]);
  const ciphertext = await aes128gcmEncrypt(cek, nonce, plain);
  const body = concatU8(salt, rsBytes, ephPub, ciphertext);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Content-Length": String(body.length),
      "Content-Type": "application/octet-stream",
      "Authorization": "vapid t=" + jwt + ", k=" + VAPID_PUBLIC,
    },
    body,
  });
  if (res.status === 410 || res.status === 404) throw new Error("GONE");
  if (res.status !== 201 && res.status !== 200 && res.status !== 202) {
    const t = await res.text();
    throw new Error("push failed " + res.status + " " + t.slice(0, 200));
  }
}

function concatU8(...arrays) {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

/* ================= 提醒检查（Cron 每分钟） ================= */
async function checkReminders(env) {
  const list = await env.PUSH_KV.list({ prefix: "u:" });
  const now = Date.now();
  for (const { name } of list.keys) {
    try {
      const rec = await env.PUSH_KV.get(name, "json");
      if (!rec || !rec.sub || !rec.cfg) continue;
      const cfg = rec.cfg;
      const local = new Date(now - (cfg.tzOffset || 0) * 60000);
      const hm = String(local.getHours()).padStart(2, "0") + ":" + String(local.getMinutes()).padStart(2, "0");
      let changed = false, msg = null;

      if (cfg.waterReminder && hm >= (cfg.waterStart || "00:00") && hm <= (cfg.waterEnd || "23:59")) {
        if (now - (cfg.lastWater || 0) > (cfg.waterInterval || 60) * 60000) {
          cfg.lastWater = now; changed = true;
          msg = { title: "💧 该喝水啦", body: "起来喝一杯 250ml，喝完后记得在工作台点「喝完了」~" };
        }
      }
      if (!msg && cfg.sitReminder) {
        if (now - (cfg.lastSit || 0) > (cfg.sitInterval || 50) * 60000) {
          cfg.lastSit = now; changed = true;
          msg = { title: "🧘 久坐提醒", body: "起身活动 2–3 分钟：拉伸、走动、靠墙静蹲。" };
        }
      }
      if (msg) {
        try {
          await sendWebPush(rec.sub, JSON.stringify(msg));
        } catch (e) {
          if (e.message === "GONE") { await env.PUSH_KV.delete(name); continue; }
          throw e;
        }
      }
      if (changed) {
        rec.updatedAt = now;
        await env.PUSH_KV.put(name, JSON.stringify(rec));
      }
    } catch (e) {
      console.error("check user " + name + " failed:", e);
    }
  }
}

/* ================= HTTP 入口 ================= */
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkReminders(env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, time: Date.now() });
    }

    if (method === "POST") {
      let body = {};
      try { body = await request.json(); } catch (e) {}
      const uid = (body.userId || "default").slice(0, 64);

      if (url.pathname === "/api/subscribe") {
        const sub = body.subscription;
        if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
          return json({ ok: false, error: "bad subscription" }, 400);
        }
        const old = await env.PUSH_KV.get("u:" + uid, "json");
        const rec = { sub, cfg: (old && old.cfg) || {}, updatedAt: Date.now() };
        await env.PUSH_KV.put("u:" + uid, JSON.stringify(rec));
        return json({ ok: true });
      }
      if (url.pathname === "/api/config") {
        const cfg = body.config || {};
        const old = await env.PUSH_KV.get("u:" + uid, "json");
        const rec = {
          sub: (old && old.sub) || null,
          cfg: {
            waterReminder: !!cfg.waterReminder,
            waterInterval: Math.max(15, Math.min(180, parseInt(cfg.waterInterval, 10) || 60)),
            waterStart: cfg.waterStart || "08:00",
            waterEnd: cfg.waterEnd || "21:30",
            sitReminder: !!cfg.sitReminder,
            sitInterval: Math.max(20, Math.min(120, parseInt(cfg.sitInterval, 10) || 50)),
            lastWater: (old && old.cfg && old.cfg.lastWater) || 0,
            lastSit: (old && old.cfg && old.cfg.lastSit) || 0,
            tzOffset: parseInt(cfg.tzOffset, 10) || 0,
          },
          updatedAt: Date.now(),
        };
        await env.PUSH_KV.put("u:" + uid, JSON.stringify(rec));
        return json({ ok: true });
      }
      if (url.pathname === "/api/unsubscribe") {
        await env.PUSH_KV.delete("u:" + uid);
        return json({ ok: true });
      }
    }
    return json({ ok: false, error: "not found" }, 404);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}

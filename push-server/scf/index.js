/* =========================================================================
 * 个人成长工作台 · 云端推送服务（腾讯云 SCF 云函数）
 * -------------------------------------------------------------------------
 * 功能：
 *  - 定时触发器（每分钟）检查饮水/久坐提醒条件，到点用 Web Push 推送给
 *    手机（锁屏也能收到，Apple Watch / 手环同步震动）
 *  - API 触发器（函数 URL / API 网关）接收前端订阅与提醒配置，存 COS
 * 部署：见 README-腾讯云推送.md / push-server/scf/deploy.js
 * ========================================================================= */

const webpush = require("web-push");
const COS = require("cos-nodejs-sdk-v5");

const BUCKET = process.env.PUSH_BUCKET;
const REGION = process.env.PUSH_REGION || "ap-guangzhou";
const CFG_KEY = "config.json";
const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@grow-workbench.app";

/* 部署时会把用户密钥写入函数环境变量，COS SDK 用它鉴权（免配置角色） */
const cos = new COS({
  SecretId: process.env.TENCENT_SECRET_ID,
  SecretKey: process.env.TENCENT_SECRET_KEY,
});
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

/* ---------------- COS 存取配置 ---------------- */
function getConfig() {
  return new Promise((resolve, reject) => {
    cos.getObject({ Bucket: BUCKET, Region: REGION, Key: CFG_KEY }, (err, data) => {
      if (err) {
        if (err.statusCode === 404 || err.code === "NoSuchKey") return resolve(null);
        return reject(err);
      }
      try { resolve(JSON.parse(data.Body.toString())); } catch (e) { resolve(null); }
    });
  });
}
function putConfig(cfg) {
  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: BUCKET, Region: REGION, Key: CFG_KEY,
      Body: JSON.stringify(cfg), ContentType: "application/json",
    }, (err) => (err ? reject(err) : resolve()));
  });
}

/* ---------------- 工具 ---------------- */
function json(obj, status = 200, cors = true) {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (cors) { headers["Access-Control-Allow-Origin"] = "*"; headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"; headers["Access-Control-Allow-Headers"] = "Content-Type"; }
  return { statusCode: status, headers, body: JSON.stringify(obj), isBase64Encoded: false };
}
function nowLocal(cfg) {
  return new Date(Date.now() - (cfg.tzOffset || 0) * 60000);
}
function timeHM(d) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

/* ---------------- 定时检查：到点推送 ---------------- */
async function checkReminders() {
  const rec = await getConfig();
  if (!rec || !rec.sub || !rec.cfg) return { checked: true, pushed: 0 };
  const cfg = rec.cfg;
  const local = nowLocal(cfg);
  const hm = timeHM(local);
  const now = Date.now();
  let changed = false, msg = null;

  if (cfg.waterReminder && hm >= (cfg.waterStart || "00:00") && hm <= (cfg.waterEnd || "23:59")) {
    if (now - (cfg.lastWater || 0) > (cfg.waterInterval || 60) * 60000) {
      cfg.lastWater = now; changed = true;
      msg = { title: "💧 该喝水啦", body: "起来喝一杯 250ml，喝完后在工作台点「喝完了」~" };
    }
  }
  if (!msg && cfg.sitReminder) {
    if (now - (cfg.lastSit || 0) > (cfg.sitInterval || 50) * 60000) {
      cfg.lastSit = now; changed = true;
      msg = { title: "🧘 久坐提醒", body: "起身活动 2–3 分钟：拉伸、走动、靠墙静蹲。" };
    }
  }
  if (msg) {
    await webpush.sendNotification(rec.sub, JSON.stringify(msg));
  }
  if (changed) await putConfig(rec);
  return { checked: true, pushed: msg ? 1 : 0 };
}

/* ---------------- 主入口：API 网关 / 函数URL / 定时 三合一 ---------------- */
exports.main_handler = async (event, context) => {
  try {
    /* 定时触发器 */
    if (event && event.Type === "Timer") {
      const r = await checkReminders();
      return json({ ok: true, ...r });
    }

    /* API 网关 / 函数 URL 请求 */
    const method = (event.httpMethod || "GET").toUpperCase();
    const path = event.path || "/";

    if (method === "OPTIONS") return json({ ok: true }, 200);

    if (method === "GET" && (path.endsWith("/api/health"))) {
      return json({ ok: true, time: Date.now(), region: REGION });
    }

    if (method === "POST") {
      let body = {};
      try { body = JSON.parse(event.body || "{}"); } catch (e) {}

      if (path.endsWith("/api/subscribe")) {
        const sub = body.subscription;
        if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
          return json({ ok: false, error: "bad subscription" }, 400);
        }
        const old = await getConfig();
        const rec = { sub, cfg: (old && old.cfg) || {}, updatedAt: Date.now() };
        await putConfig(rec);
        return json({ ok: true });
      }
      if (path.endsWith("/api/config")) {
        const cfg = body.config || {};
        const old = await getConfig();
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
        await putConfig(rec);
        return json({ ok: true });
      }
      if (path.endsWith("/api/unsubscribe")) {
        await putConfig({ cleared: true, updatedAt: Date.now() });
        return json({ ok: true });
      }
    }
    return json({ ok: false, error: "not found" }, 404);
  } catch (e) {
    console.error("handler error:", e);
    return json({ ok: false, error: String(e && e.message || e) }, 500);
  }
};

/* =========================================================================
 * 个人成长工作台 · 腾讯云 SCF 自动部署脚本
 * 用法：node deploy.js <SecretId> <SecretKey> <AppId> [region]
 * AppId：腾讯云控制台右上角/账号信息里的 10 位数字（创建 COS 桶必需）
 * 自动完成：创建 COS 桶 → 打包上传 → 创建云函数 → 定时触发器 → API 网关
 * ========================================================================= */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const SecretId = process.argv[2];
const SecretKey = process.argv[3];
const AppId = process.argv[4];
const Region = process.argv[5] || "ap-guangzhou";
if (!SecretId || !SecretKey || !AppId) {
  console.error("用法: node deploy.js <SecretId> <SecretKey> <AppId> [region]");
  process.exit(1);
}

/* VAPID 密钥从 .vapid-keys.txt 读取（该文件已在 .gitignore，不入库） */
const KEYFILE = path.join(__dirname, "..", "..", ".vapid-keys.txt");
function loadVapidKeys() {
  if (!fs.existsSync(KEYFILE)) {
    console.error("缺少密钥文件: " + KEYFILE + "\n请先用 web-push generate-vapid-keys 生成并保存。");
    process.exit(1);
  }
  const lines = fs.readFileSync(KEYFILE, "utf8").split(/\r?\n/);
  const get = (k) => (lines.find(l => l.startsWith(k + "=")) || "").split("=").slice(1).join("=");
  const pub = get("PUBLIC"), priv = get("PRIVATE");
  if (!pub || !priv) { console.error("密钥文件格式不对（需要 PUBLIC=/PRIVATE= 两行）"); process.exit(1); }
  return { pub, priv };
}
const VAPID = loadVapidKeys();
const NODE_MODULES = "C:/Users/24470/.workbuddy/binaries/node/workspace/node_modules";

/* ---------- TC3 签名 + 调用 ---------- */
function sha256hex(str) { return crypto.createHash("sha256").update(str, "utf8").digest("hex"); }
function hmac(key, msg) { return crypto.createHmac("sha256", key).update(msg, "utf8").digest(); }
function signTC3(host, payload, secretId, secretKey, service, region, action, version, ct) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const ts = Math.floor(now.getTime() / 1000);
  const contentType = ct || "application/json; charset=utf-8";
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, sha256hex(body)].join("\n");
  const scope = `${date}/${region}/${service}/tc3_request`;
  const stringToSign = ["TC3-HMAC-SHA256", ts, scope, sha256hex(canonicalRequest)].join("\n");
  const secretDate = hmac("TC3" + secretKey, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = crypto.createHmac("sha256", secretSigning).update(stringToSign, "utf8").digest("hex");
  return {
    ts, contentType, body,
    authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
async function call(service, action, params, opts = {}) {
  const host = `${service}.tencentcloudapi.com`;
  const region = opts.region || Region;
  const version = opts.version || (service === "scf" ? "2018-04-16" : service === "apigateway" ? "2018-08-08" : "2018-11-26");
  const s = signTC3(host, params, SecretId, SecretKey, service, region, action, version);
  const res = await fetch(`https://${host}/`, {
    method: "POST",
    headers: {
      "Content-Type": s.contentType,
      "Authorization": s.authorization,
      "X-TC-Action": action,
      "X-TC-Version": version,
      "X-TC-Timestamp": String(s.ts),
      "X-TC-Region": region,
      "Host": host,
    },
    body: s.body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${service}.${action} HTTP ${res.status}: ${text.slice(0, 400)}`);
  const j = JSON.parse(text);
  if (j.Response && j.Response.Error) throw new Error(`${service}.${action}: ${j.Response.Error.Message} (${j.Response.Error.Code})`);
  return j.Response || j;
}

/* ---------- 打包：index.js + 依赖（zip，用 PowerShell Compress-Archive） ---------- */
function buildZip() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pushscf-"));
  const dst = path.join(tmp, "grow-push");
  fs.mkdirSync(path.join(dst, "node_modules"), { recursive: true });
  fs.copyFileSync(path.join(__dirname, "index.js"), path.join(dst, "index.js"));
  for (const pkg of ["web-push", "cos-nodejs-sdk-v5"]) {
    execSync(`cp -r "${path.join(NODE_MODULES, pkg)}" "${path.join(dst, "node_modules", pkg)}"`);
  }
  // 补充依赖树：web-push/cos 依赖的包（浅拷贝 workspace node_modules 下它们所需的包）
  const need = ["https-proxy-agent", "agent-base", "jws", "jwa", "safe-buffer", "stream-events", "duplexify", "end-of-stream", "once", "wrappy", "jwa", "ecdsa-sig-formatter", "buffer-equal-constant-time", "ms", "xml2js", "sax", "xmlbuilder", "fast-xml-parser", "mime-db", "semver", "uuid", "undici-types"];
  for (const p of need) {
    const src = path.join(NODE_MODULES, p);
    if (fs.existsSync(src)) execSync(`cp -r "${src}" "${path.join(dst, "node_modules", p)}"`);
  }
  const zipPath = path.join(tmp, "func.zip");
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${dst}\\*' -DestinationPath '${zipPath}' -Force"`);
  const base64 = fs.readFileSync(zipPath).toString("base64");
  fs.rmSync(tmp, { recursive: true, force: true });
  return base64;
}

/* ---------- 主流程 ---------- */
(async () => {
  console.log("① 创建 COS 桶…");
  const bucketName = "grow-push-cos-" + Math.random().toString(36).slice(2, 10);
  try {
    await call("cos", "CreateBucket", { Bucket: `${bucketName}-${AppId}` }, { version: "2018-11-26" });
    console.log("  ✅ COS 桶:", `${bucketName}-${AppId}`);
  } catch (e) {
    if (String(e.message).includes("BucketAlreadyExists")) {
      console.log("  ⚠ 桶已存在，复用");
    } else {
      console.log("  ⚠ COS 桶创建失败（不影响函数部署，稍后手动建）:", e.message.slice(0, 150));
    }
  }

  console.log("② 打包函数代码…");
  const zipBase64 = buildZip();
  console.log("  ✅ 打包完成");

  console.log("③ 创建云函数 grow-push…");
  const envVars = [
    { Key: "PUSH_BUCKET", Value: bucketName },
    { Key: "PUSH_REGION", Value: Region },
    { Key: "VAPID_PUBLIC", Value: VAPID.pub },
    { Key: "VAPID_PRIVATE", Value: VAPID.priv },
    { Key: "VAPID_SUBJECT", Value: "mailto:admin@grow-workbench.app" },
    { Key: "TENCENT_SECRET_ID", Value: SecretId },
    { Key: "TENCENT_SECRET_KEY", Value: SecretKey },
  ];
  const fn = await call("scf", "CreateFunction", {
    FunctionName: "grow-push",
    Code: { ZipFile: zipBase64 },
    Handler: "index.main_handler",
    Runtime: "Nodejs16.13",
    Description: "个人成长工作台 · 云端推送（饮水/久坐提醒）",
    MemorySize: 128,
    Timeout: 60,
    Environment: { Variables: envVars },
    PublicNetConfig: { PublicNetStatus: "ENABLE", EipConfig: { EipStatus: "DISABLE" } },
  });
  console.log("  ✅ 云函数创建成功");

  console.log("④ 创建定时触发器（每分钟检查提醒）…");
  try {
    await call("scf", "CreateTrigger", {
      FunctionName: "grow-push",
      TriggerName: "grow-push-timer",
      Type: "timer",
      TriggerDesc: "0 */1 * * * * *",
      Enable: "OPEN",
    });
    console.log("  ✅ 定时触发器创建成功");
  } catch (e) {
    if (String(e.message).includes("AlreadyExists")) console.log("  ⚠ 定时触发器已存在");
    else console.log("  ⚠ 定时触发器:", e.message.slice(0, 150));
  }

  console.log("⑤ 创建 API 网关触发器（前端上传订阅/配置用）…");
  try {
    const trig = await call("scf", "CreateTrigger", {
      FunctionName: "grow-push",
      TriggerName: "grow-push-apigw",
      Type: "apigw",
      TriggerDesc: JSON.stringify({
        api: { authRequired: "FALSE", requestConfig: { method: "ANY", path: "/" }, isIntegratedResponse: "TRUE" },
        service: { serviceName: "grow-push-service", protocol: "https" },
        release: { environmentName: "release" },
      }),
      Enable: "OPEN",
    });
    console.log("  ✅ API 网关触发器创建成功");
    // 查询触发器拿访问地址
    try {
      const list = await call("scf", "ListTriggers", { FunctionName: "grow-push" });
      const apigwTrig = (list.Triggers || []).find(t => t.Type === "apigw");
      if (apigwTrig && apigwTrig.TriggerDesc) {
        try {
          const desc = JSON.parse(apigwTrig.TriggerDesc);
          const sub = (desc.api && desc.api.subDomain) || (desc.service && desc.service.subDomain) || "";
          if (sub) {
            const apiUrl = `https://${sub}/release/`;
            console.log("\n✅✅ 前端 PUSH_SERVER 地址：");
            console.log("    " + apiUrl);
            fs.writeFileSync(path.join(__dirname, "api-url.txt"), apiUrl);
          }
        } catch (e2) {}
      }
    } catch (e3) {}
    console.log("  如果上方没有输出地址，请在控制台：云函数 → grow-push → 触发管理 → 复制 API 网关访问地址");
  } catch (e) {
    if (String(e.message).includes("AlreadyExists")) console.log("  ⚠ API 网关触发器已存在");
    else console.log("  ⚠ API 网关触发器:", e.message.slice(0, 200));
  }

  console.log("\n部署流程完成！剩余步骤：把上面得到的 API 地址填入前端 js/app.js 的 PUSH_SERVER。");
})().catch((e) => { console.error("\n部署失败:", e); process.exit(1); });

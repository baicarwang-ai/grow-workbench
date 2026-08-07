/* =========================================================================
 * 个人成长工作台 · 腾讯云 SCF 自动部署脚本（官方 SDK 版）
 * 用法：node deploy.js <SecretId> <SecretKey> <AppId> [region]
 * ========================================================================= */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const SecretId = process.argv[2];
const SecretKey = process.argv[3];
const AppId = process.argv[4];
const Region = process.argv[5] || "ap-guangzhou";
if (!SecretId || !SecretKey || !AppId) {
  console.error("用法: node deploy.js <SecretId> <SecretKey> <AppId> [region]");
  process.exit(1);
}

const NODE_MODULES = "C:/Users/24470/.workbuddy/binaries/node/workspace/node_modules";
const COS = require(path.join(NODE_MODULES, "cos-nodejs-sdk-v5"));
const tencentcloud = require(path.join(NODE_MODULES, "tencentcloud-sdk-nodejs"));
const ScfClient = tencentcloud.scf.v20180416.Client;
const ApigwClient = tencentcloud.apigateway.v20180808.Client;
const CamClient = tencentcloud.cam.v20190116.Client;

/* VAPID 密钥从 .vapid-keys.txt 读取（已 gitignore，不入库） */
const KEYFILE = path.join(__dirname, "..", "..", ".vapid-keys.txt");
function loadVapidKeys() {
  if (!fs.existsSync(KEYFILE)) {
    console.error("缺少密钥文件: " + KEYFILE);
    process.exit(1);
  }
  const lines = fs.readFileSync(KEYFILE, "utf8").split(/\r?\n/);
  const get = (k) => (lines.find(l => l.startsWith(k + "=")) || "").split("=").slice(1).join("=");
  const pub = get("PUBLIC"), priv = get("PRIVATE");
  if (!pub || !priv) { console.error("密钥文件格式不对"); process.exit(1); }
  return { pub, priv };
}
const VAPID = loadVapidKeys();
const cos = new COS({ SecretId, SecretKey });
const scf = new ScfClient({ credential: { secretId: SecretId, secretKey: SecretKey }, region: Region, profile: { httpProfile: { endpoint: "scf.tencentcloudapi.com", reqTimeout: 60 } } });
const apigw = new ApigwClient({ credential: { secretId: SecretId, secretKey: SecretKey }, region: Region, profile: { httpProfile: { endpoint: "apigateway.tencentcloudapi.com", reqTimeout: 60 } } });
const cam = new CamClient({ credential: { secretId: SecretId, secretKey: SecretKey }, region: "", profile: { httpProfile: { endpoint: "cam.tencentcloudapi.com", reqTimeout: 60 } } });

function cosCall(method, params) {
  return new Promise((resolve, reject) => cos[method](params, (err, data) => (err ? reject(err) : resolve(data))));
}

/* ---------- 创建 SCF 默认角色（首次使用 SCF 时不存在） ---------- */
async function ensureScfRole() {
  try {
    await cam.CreateRole({
      RoleName: "SCF_QcsRole",
      PolicyDocument: JSON.stringify({
        version: "2.0",
        statement: [{
          action: "sts:AssumeRole",
          effect: "allow",
          principal: { service: ["scf.qcloud.com"] },
        }],
      }),
      Description: "SCF 云函数默认服务角色",
    });
    console.log("  ✅ 角色 SCF_QcsRole 已创建");
  } catch (e) {
    if (!String(e.code).includes("InvalidParameter.RoleNameInUse")) console.log("  ⚠ 创建角色:", (e.message || e.code).slice(0, 150));
  }
  try {
    await cam.AttachRolePolicy({ PolicyName: "QcloudSCFFullAccess", AttachRoleName: "SCF_QcsRole" });
  } catch (e) {
    if (!String(e.code).includes("InvalidParameter")) console.log("  ⚠ 绑定策略:", (e.message || e.code).slice(0, 120));
  }
  try {
    await cam.AttachRolePolicy({ PolicyName: "QcloudCLSFullAccess", AttachRoleName: "SCF_QcsRole" });
  } catch (e) {
    if (!String(e.code).includes("InvalidParameter")) console.log("  ⚠ 绑定CLS策略:", (e.message || e.code).slice(0, 120));
  }
}

/* ---------- 打包：index.js + 完整依赖树（npm install 保证不遗漏） ---------- */
function buildZip() {
  return new Promise((resolve, reject) => {
    const NODE = "C:/Users/24470/.workbuddy/binaries/node/versions/22.22.2/node.exe";
    const NPM = "C:/Users/24470/.workbuddy/binaries/node/versions/22.22.2/node_modules/npm/bin/npm-cli.js";
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pushscf-"));
    const dst = path.join(tmp, "grow-push");
    fs.mkdirSync(dst, { recursive: true });
    fs.copyFileSync(path.join(__dirname, "index.js"), path.join(dst, "index.js"));
    fs.writeFileSync(path.join(dst, "package.json"), JSON.stringify({
      name: "grow-push-scf", version: "1.0.0", private: true, main: "index.js",
      dependencies: { "web-push": "^3.6.7", "cos-nodejs-sdk-v5": "^2.14.8" },
    }));
    try {
      execSync(`"${NODE}" "${NPM}" install --omit=dev --no-audit --no-fund --loglevel=error`, { cwd: dst, stdio: ["ignore", "inherit", "inherit"], timeout: 300000 });
      const zipPath = path.join(tmp, "func.zip");
      execSync(`"C:\\Windows\\System32\\tar.exe" -a -cf "${zipPath}" index.js node_modules`, { cwd: dst });
      const base64 = fs.readFileSync(zipPath).toString("base64");
      fs.rmSync(tmp, { recursive: true, force: true });
      resolve(base64);
    } catch (e) {
      fs.rmSync(tmp, { recursive: true, force: true });
      reject(e);
    }
  });
}

/* ---------- 等待函数状态正常 ---------- */
async function waitFunctionActive(name) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    try {
      const r = await scf.GetFunctionStatus({ FunctionName: name });
      const st = (r.Status || "").toLowerCase();
      if (st === "active" || st === "normal") return true;
    } catch (e) { /* ignore */ }
    await new Promise(r => setTimeout(r, 5000));
  }
  return false;
}

(async () => {
  const bucketName = "grow-push-cos-" + Math.random().toString(36).slice(2, 10);
  const fullBucket = `${bucketName}-${AppId}`;

  console.log("① 创建 COS 桶…");
  try {
    await cosCall("putBucket", { Bucket: fullBucket, Region });
    console.log("  ✅ COS 桶:", fullBucket);
  } catch (e) {
    if (String(e.code || e).includes("BucketAlreadyExists")) console.log("  ⚠ 桶已存在");
    else console.log("  ⚠ COS 桶:", (e.message || e.code || e).slice(0, 150));
  }

  console.log("② 打包函数代码…");
  const zipBase64 = await buildZip();
  console.log("  ✅ 打包完成");

  console.log("③ 准备云函数运行角色…");
  await ensureScfRole();

  console.log("④ 创建云函数 grow-push…");
  try {
    const fn = await scf.CreateFunction({
      FunctionName: "grow-push",
      Role: "SCF_QcsRole",
      Code: { ZipFile: zipBase64 },
      Handler: "index.main_handler",
      Runtime: "Nodejs16.13",
      Description: "个人成长工作台 · 云端推送（饮水/久坐提醒）",
      MemorySize: 128,
      Timeout: 60,
      Environment: { Variables: [
        { Key: "PUSH_BUCKET", Value: fullBucket },
        { Key: "PUSH_REGION", Value: Region },
        { Key: "VAPID_PUBLIC", Value: VAPID.pub },
        { Key: "VAPID_PRIVATE", Value: VAPID.priv },
        { Key: "VAPID_SUBJECT", Value: "mailto:admin@grow-workbench.app" },
        { Key: "TENCENT_SECRET_ID", Value: SecretId },
        { Key: "TENCENT_SECRET_KEY", Value: SecretKey },
      ] },
      PublicNetConfig: { PublicNetStatus: "ENABLE", EipConfig: { EipStatus: "DISABLE" } },
    });
    console.log("  ✅ 云函数创建成功:", fn.FunctionName || "grow-push");
  } catch (e) {
    if (String(e.code).includes("ResourceInUse")) {
      console.log("  ⚠ 函数已存在，改为更新代码…");
      await scf.UpdateFunctionCode({ FunctionName: "grow-push", Handler: "index.main_handler", Code: { ZipFile: zipBase64 } });
      await scf.UpdateFunctionConfiguration({ FunctionName: "grow-push", Environment: { Variables: [
        { Key: "PUSH_BUCKET", Value: fullBucket },
        { Key: "PUSH_REGION", Value: Region },
        { Key: "VAPID_PUBLIC", Value: VAPID.pub },
        { Key: "VAPID_PRIVATE", Value: VAPID.priv },
        { Key: "VAPID_SUBJECT", Value: "mailto:admin@grow-workbench.app" },
        { Key: "TENCENT_SECRET_ID", Value: SecretId },
        { Key: "TENCENT_SECRET_KEY", Value: SecretKey },
      ] }, Timeout: 60, MemorySize: 128 });
      console.log("  ✅ 函数已更新");
    } else {
      throw e;
    }
  }

  console.log("④ 等待函数状态正常…");
  const active = await waitFunctionActive("grow-push");
  console.log(active ? "  ✅ 函数已就绪" : "  ⚠ 等待超时，稍后可在控制台补触发器");

  console.log("⑤ 创建定时触发器（每分钟）…");
  try {
    await scf.CreateTrigger({ FunctionName: "grow-push", TriggerName: "grow-push-timer", Type: "timer", TriggerDesc: "0 */1 * * * * *", Enable: "OPEN" });
    console.log("  ✅ 定时触发器创建成功");
  } catch (e) {
    if (String(e.code).includes("ResourceInUse")) console.log("  ⚠ 定时触发器已存在");
    else console.log("  ⚠ 定时触发器:", (e.message || e.code).slice(0, 150));
  }

  console.log("⑥ 创建函数 URL（Type=http，替代已停售的经典 API 网关）…");
  let apiUrl = "";
  try {
    await scf.CreateTrigger({
      FunctionName: "grow-push",
      TriggerName: "grow-push-url",
      Type: "http",
      TriggerDesc: JSON.stringify({
        AuthType: "NONE",
        NetConfig: { EnableIntranet: true, EnableExtranet: true },
        CorsConfig: { Enable: true, Origins: ["*"], Headers: ["content-type"], Methods: ["POST", "GET", "OPTIONS"], ExposeHeaders: ["*"], MaxAge: 10, Credentials: true },
      }),
      Enable: "OPEN",
    });
    console.log("  ✅ 函数 URL 创建成功");
  } catch (e) {
    if (String(e.code).includes("ResourceInUse")) console.log("  ⚠ 函数 URL 已存在");
    else console.log("  ⚠ 函数 URL:", (e.message || e.code).slice(0, 200));
  }

  // 查询获取公网 URL
  try {
    const list = await scf.ListTriggers({ FunctionName: "grow-push" });
    const t = (list.Triggers || []).find(x => x.Type === "http");
    if (t) {
      const d = JSON.parse(t.TriggerDesc || "{}");
      const url = (d.NetConfig && d.NetConfig.ExtranetUrl) || "";
      if (url) {
        apiUrl = url.replace(/\/$/, "") + "/";
        console.log("\n✅✅ 前端 PUSH_SERVER 地址：\n    " + apiUrl);
        fs.writeFileSync(path.join(__dirname, "api-url.txt"), apiUrl);
      }
    }
  } catch (e) {
    console.log("  ⚠ 查询 URL:", (e.message || e.code).slice(0, 150));
  }

  if (!apiUrl) {
    console.log("\n⚠ 未自动获取到地址，请在控制台查看：");
    console.log("   云函数 → grow-push → 触发管理 → 函数 URL 的「访问地址」");
    console.log("   形如 https://xxxxx.ap-guangzhou.tencentscf.com");
  }
  console.log("\n部署流程完成！");
})().catch((e) => { console.error("\n部署失败:", e); process.exit(1); });

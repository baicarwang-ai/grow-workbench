# 腾讯云 SCF 云端推送部署指南（锁屏准时提醒 · 国内稳定）

> 代替无法访问的 Cloudflare Workers：用**腾讯云云函数（SCF）**实现同一套 Web Push 服务。
> 腾讯云服务国内直连，手机锁屏/页面不打开也能准时收到饮水/久坐提醒，手表同步震动。
> **免费额度**：SCF 每月 40 万次调用免费 + 定时触发器免费 + COS 免费额度，个人用完全够。

---

## 你需要先完成（约 10 分钟，只有你能做）

1. **注册腾讯云**：https://cloud.tencent.com/register（微信/QQ 扫码注册）
2. **实名认证**：控制台 https://console.cloud.tencent.com/developer 里点「实名认证」（个人实名：身份证 + 微信/人脸即可）
3. **创建 API 密钥**：https://console.cloud.tencent.com/cam/capi
   - 点「新建密钥」，得到一对 **SecretId** 和 **SecretKey**
4. 找到你的 **AppID**：https://console.cloud.tencent.com/developer → 账号信息里的「账号 ID / AppID」（10 位数字）

然后把 **SecretId、SecretKey、AppID** 发给我，剩下的我全自动部署。

---

## 我部署完成后（自动完成，无需你操作）

脚本 `push-server/scf/deploy.js` 会自动：
1. 创建 COS 存储桶（存放提醒配置）
2. 打包推送服务代码（含 web-push 库）上传
3. 创建云函数 `grow-push`（Node.js 16，环境变量注入 VAPID 密钥）
4. 创建定时触发器（**每分钟**检查饮水/久坐条件）
5. 创建 API 网关触发器（前端上传订阅与配置的入口）
6. 输出 API 访问地址，并自动写入前端 `js/app.js` 的 `PUSH_SERVER`

然后 git push 更新线上页面，手机端即可启用「☁️ 云端推送」。

---

## 手动部署（如果自动脚本某步失败，备用方案）

1. 控制台 → **云函数** https://console.cloud.tencent.com/scf → 新建函数：
   - 创建方式：**从头开始**，函数名 `grow-push`，运行环境 **Nodejs16.13**，执行方法 `index.main_handler`，内存 128M，超时 60 秒
   - 提交方法：**本地上传 zip**（把 `index.js` 和 `node_modules/web-push`、`node_modules/cos-nodejs-sdk-v5` 打进 zip）
2. **环境变量** 配置：
   | Key | Value |
   | --- | --- |
   | PUSH_BUCKET | 你创建的 COS 桶名（不带后缀） |
   | PUSH_REGION | ap-guangzhou（按你区域） |
   | VAPID_PUBLIC / VAPID_PRIVATE | 见 `.vapid-keys.txt` |
   | VAPID_SUBJECT | mailto:admin@grow-workbench.app |
   | TENCENT_SECRET_ID / TENCENT_SECRET_KEY | 你的 API 密钥 |
3. **创建函数 URL**：触发管理 → 创建触发器 → 类型选 **URL 访问**（Type=http，匿名访问、开启公网+CORS），生成 `https://xxxxx.ap-guangzhou.tencentscf.com` 公网地址
4. 把函数 URL 填入前端 `js/app.js` 的 `PUSH_SERVER`

## 验证

浏览器打开 `你的API地址/api/health`，应返回 `{"ok": true, ...}`。

## 常见问题

| 问题 | 处理 |
| --- | --- |
| 手机收不到推送 | 必须从「添加到主屏幕」图标打开工作台；iOS 需 16.4+；通知权限允许 |
| 时间不对 | 检查函数环境变量 `PUSH_REGION` 与手机时区（脚本已自动上传 tzOffset） |
| 订阅失效（报错 410 类） | 重新在手机端点一次「停用」再「启用」 |
| 免费额度够吗 | SCF 每月 40 万次调用 + 每天几百次触发，远够 |

## 安全

- SecretId/SecretKey 只用于部署，写入函数环境变量后请到控制台**删除该密钥对**（或保持无权限泄露风险，函数内调用 COS 需要它）
- VAPID 私钥在 `.vapid-keys.txt`（已 gitignore，不入库）

# 云端推送部署指南（锁屏也能准时提醒）

> 目标：手机锁屏 / 页面不打开时，也能准时收到「饮水 / 久坐」提醒（手表同步震动）。
> 原理：Cloudflare Workers（免费）每 1 分钟检查你的提醒设置，到点通过 Web Push 推送给手机。
> 总耗时约 15 分钟，**全程免费**。

---

## 前提条件

1. **手机 iOS ≥ 16.4**（苹果）或安卓 Chrome / Edge
2. 工作台已**添加到主屏幕**（Safari 分享 → 添加到主屏幕），推送功能需从主屏幕图标打开才可用
3. 有一个 **Cloudflare 账号**（免费注册：https://dash.cloudflare.com/sign-up）

---

## 一、注册并登录 Cloudflare

打开 https://dash.cloudflare.com 注册/登录。

## 二、创建 Worker

1. 进入仪表盘 → 左侧 **Workers 和 Pages** → **创建** → **创建 Worker**
2. 起个名字：`grow-push`（或任意名字），点 **部署**（会生成一个默认 worker）
3. 进入刚创建的 Worker → **编辑代码**
4. **清空**默认代码，把本目录 `push-server/worker.js` 的内容**全部粘贴**进去
5. 点右上角 **部署** 保存

> 📌 记下你的 Worker 地址，形如：`https://grow-push.你的子域.workers.dev/`

## 三、创建 KV 存储并绑定

1. 左侧 **Workers 和 Pages** → **KV** → **创建命名空间**
2. 名称填 `PUSH_KV` → 创建
3. 回到你的 Worker → **设置** → **变量和机密** → **KV 命名空间绑定** → **编辑**
4. 添加绑定：
   - 变量名称：`PUSH_KV`
   - KV 命名空间：选择刚创建的 `PUSH_KV`
5. 保存

## 四、确认 VAPID 密钥（已预置）

本项目的 `push-server/worker.js` 和 `js/app.js` 里已内置了**同一对** VAPID 密钥
（生成于本项目搭建时，见 `.vapid-keys.txt`，勿外传私钥）。
**无需修改**，两端配对即可用。如果你要换自己的密钥：

```bash
# 用 Node 生成新密钥对
npm i -g web-push
web-push generate-vapid-keys
```

然后把 `worker.js` 顶部 `VAPID_PUBLIC / VAPID_PRIVATE` 和 `js/app.js` 顶部
`VAPID_PUBLIC_KEY` 一起替换成新值。

## 五、前端接入你的 Worker 地址

打开 `js/app.js`，找到顶部：

```js
const PUSH_SERVER = "https://PUSH-YOUR-WORKER.workers.dev/";
```

替换成你的 Worker 地址（**注意保留结尾的 `/`**），例如：

```js
const PUSH_SERVER = "https://grow-push.你的子域.workers.dev/";
```

然后提交推送到 GitHub，等 Pages 更新（约 1 分钟）：

```bash
git add -A
git commit -m "接入云端推送服务"
git push
```

## 六、手机上启用

1. 从**主屏幕图标**打开工作台（不要用 Safari 标签页）
2. 打开「作息与健康 → 饮水」卡片里的 **☁️ 云端推送**
3. 点 **「启用云端推送」** → 浏览器会要求通知权限，点**允许**
4. 看到「✅ 已开启」即成功

**测试**：把饮水提醒间隔临时改成 1 分钟，锁屏放着，1 分钟后应收到推送通知（手表同步震动）。

## 七、验证服务正常

浏览器打开 `你的Worker地址/api/health`，应返回：

```json
{"ok": true, "time": 1760000000000}
```

---

## 常见问题

| 问题 | 处理 |
| --- | --- |
| 启用时报"云端服务未部署" | 没替换 `PUSH_SERVER`，或 Pages 还没更新（强刷 / 稍等） |
| 手机上无法订阅 | 必须从「添加到主屏幕」的图标打开；iOS 需 16.4+；确认通知权限已允许 |
| 收到 410 / 订阅失效 | 说明订阅过期（如卸载重装过），重新点一次「启用」即可 |
| 提醒没到点就收到 | Worker 每分钟检查一次，误差 ≤ 1 分钟；以你手机本地时区判断时段 |
| 改间隔/时段后没生效 | 每次修改会自动同步到云端；若没同步，重新点一次「停用」再「启用」 |

## 费用说明

- Cloudflare Workers **免费版**：每天 10 万次请求、每分钟 1 次定时触发，个人提醒用量远低于限额
- 无需信用卡，无隐藏费用

## 安全提示

- `.vapid-keys.txt` 含推送私钥，**不要**提交到 GitHub（已加入 `.gitignore`）
- Worker 代码里也含私钥：Cloudflare Worker 本身是私有代码，不公开；但如要开源仓库，请把 `worker.js` 里的 `VAPID_PRIVATE` 换成环境变量引用

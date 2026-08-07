/* =========================================================================
 * 个人成长工作台（手机版）· 本地静态服务器
 * 用途：同一 WiFi 下手机通过局域网 IP 访问本工作台。
 * 双击「启动手机版.bat」即可，无需安装任何依赖（仅需 Node.js）。
 * ========================================================================= */
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = process.env.PORT || 8341;
const ROOT = path.join(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end("404 Not Found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  } catch (e) {
    res.writeHead(500); res.end();
  }
});

function lanIPs() {
  const list = [];
  for (const [name, ifaces] of Object.entries(os.networkInterfaces())) {
    for (const i of ifaces) {
      if (i.family === "IPv4" && !i.internal) list.push(i.address);
    }
  }
  return list;
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("==============================================");
  console.log("  个人成长工作台 · 手机版已启动");
  console.log("----------------------------------------------");
  console.log("  本机访问   http://localhost:" + PORT);
  lanIPs().forEach(ip => console.log("  手机访问   http://" + ip + ":" + PORT));
  console.log("----------------------------------------------");
  console.log("  手机需与本电脑连接同一 WiFi");
  console.log("  建议用手机浏览器打开后「添加到主屏幕」");
  console.log("==============================================");
});

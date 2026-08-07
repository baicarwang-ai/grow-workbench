/* =========================================================================
 * 个人成长工作台 · Service Worker（离线缓存）
 * 首次访问后缓存全部静态资源，之后离线也能打开。
 * ========================================================================= */
const CACHE_NAME = "grow-workbench-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./css/mobile.css",
  "./js/data.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* 菜谱图片（本地 SVG，b/d/l 各 8 张 + s 系列 2 张，共 26 张） */
const RECIPE_IMAGES = [];
for (const p of ["b", "d", "l"]) {
  for (let i = 1; i <= 8; i++) RECIPE_IMAGES.push(`./img/recipes/${p}${String(i).padStart(2, "0")}.svg`);
}
RECIPE_IMAGES.push("./img/recipes/s01.svg", "./img/recipes/s02.svg");

const PRECACHE = CORE_ASSETS.concat(RECIPE_IMAGES);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // 个别图片缺失不影响安装
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 外链（B 站等）不拦截

  // 网络优先，失败回退缓存（保证数据接口类请求总是最新）
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && (req.url.indexOf("http") === 0)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});

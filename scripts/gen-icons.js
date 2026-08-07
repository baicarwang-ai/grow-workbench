/* 生成 PWA 图标：icon-source.svg -> icon-192.png / icon-512.png */
const path = require("path");
const sharp = require("C:/Users/24470/.workbuddy/binaries/node/workspace/node_modules/sharp");

const src = path.join(__dirname, "..", "icons", "icon-source.svg");
const outDir = path.join(__dirname, "..", "icons");

(async () => {
  for (const size of [192, 512]) {
    await sharp(src)
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon-${size}.png`));
    console.log(`OK icon-${size}.png`);
  }
})().catch((e) => { console.error(e); process.exit(1); });

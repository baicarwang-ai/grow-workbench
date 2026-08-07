@echo off
chcp 65001 >nul
title 个人成长工作台（手机版）
echo 正在启动服务器...
start "" cmd /k "node scripts\serve.js"
timeout /t 2 >nul
start http://localhost:8341

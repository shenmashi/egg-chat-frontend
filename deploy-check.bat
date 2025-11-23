@echo off
chcp 65001 >nul
echo ========================================
echo    部署检查脚本
echo ========================================
echo.

echo [1/5] 检查前端构建文件...
if exist "build\index.html" (
    echo    ✓ 前端构建文件存在
    echo    构建时间: 
    dir build\index.html | findstr /C:"index.html"
) else (
    echo    ✗ 前端构建文件不存在
    echo    请执行: npm run build
    echo.
    set NEED_BUILD=1
)
echo.

echo [2/5] 检查后端服务 (7001 端口)...
netstat -ano 2>nul | findstr ":7001" 2>nul | findstr "LISTENING" 2>nul >nul
if %errorlevel% equ 0 (
    echo    ✓ 后端服务正在运行 (端口 7001)
    netstat -ano 2>nul | findstr ":7001" 2>nul | findstr "LISTENING"
) else (
    echo    ✗ 后端服务未运行 (端口 7001)
    echo    请启动后端服务
    echo.
    set BACKEND_DOWN=1
)
echo.

echo [3/5] 检查 Nginx 进程...
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% equ 0 (
    echo    ✓ Nginx 正在运行
    echo    进程信息:
    tasklist /FI "IMAGENAME eq nginx.exe" /FO TABLE
) else (
    echo    ✗ Nginx 未运行
    echo    请执行: nginx-start.bat
    echo.
    set NGINX_DOWN=1
)
echo.

echo [4/5] 检查 Nginx 监听端口...
netstat -ano 2>nul | findstr ":8989" 2>nul | findstr "LISTENING" 2>nul >nul
if %errorlevel% equ 0 (
    echo    ✓ Nginx 正在监听 8989 端口
    netstat -ano 2>nul | findstr ":8989" 2>nul | findstr "LISTENING"
) else (
    echo    ✗ Nginx 未监听 8989 端口
    echo    请检查 Nginx 配置
    echo.
    set PORT_ERROR=1
)
echo.

echo [5/5] 检查 Nginx 配置文件...
set NGINX_PATH=C:\Program Files\nginx-1.28.0
if exist "%NGINX_PATH%\conf\sites-enabled\qhkf.qh1851.com.8989.conf" (
    echo    ✓ Nginx 8989 配置文件存在
) else (
    echo    ✗ Nginx 8989 配置文件不存在
    echo    请复制配置文件到: %NGINX_PATH%\conf\sites-enabled\
    echo.
    set CONFIG_MISSING=1
)

echo.
echo ========================================
echo    检查结果
echo ========================================
echo.

if defined NEED_BUILD (
    echo [需要操作] 前端需要重新构建
    echo    执行命令: npm run build
    echo    或者运行: build-frontend.bat
    echo.
)

if defined BACKEND_DOWN (
    echo [需要操作] 后端服务未运行
    echo    请启动后端服务 (端口 7001)
    echo.
)

if defined NGINX_DOWN (
    echo [需要操作] Nginx 未运行
    echo    执行命令: nginx-start.bat
    echo.
)

if defined PORT_ERROR (
    echo [需要操作] Nginx 端口配置有问题
    echo    请检查配置文件并重启: nginx-restart.bat
    echo.
)

if defined CONFIG_MISSING (
    echo [需要操作] Nginx 配置文件缺失
    echo    请复制配置文件到 Nginx 目录
    echo.
)

if not defined NEED_BUILD if not defined BACKEND_DOWN if not defined NGINX_DOWN if not defined PORT_ERROR if not defined CONFIG_MISSING (
    echo ✓ 所有检查通过！
    echo.
    echo 访问地址: http://qhkf.qh1851.com:8989
    echo.
)

pause


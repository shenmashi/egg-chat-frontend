@echo off
chcp 65001 >nul
echo ========================================
echo    Nginx 停止脚本
echo ========================================
echo.

REM 设置 Nginx 安装路径（根据实际情况修改）
set NGINX_PATH=C:\Program Files\nginx-1.28.0

REM 检查 Nginx 路径是否存在
if not exist "%NGINX_PATH%" (
    echo [错误] Nginx 路径不存在: %NGINX_PATH%
    echo 请修改脚本中的 NGINX_PATH 变量
    pause
    exit /b 1
)

REM 切换到 Nginx 目录
cd /d "%NGINX_PATH%"

echo [1/2] 检查 Nginx 进程...
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% neq 0 (
    echo    未发现 Nginx 进程
    echo.
    echo Nginx 未运行，无需停止
    pause
    exit /b 0
)

echo    发现 Nginx 进程正在运行
echo.
echo [2/2] 停止 Nginx...
REM 先尝试优雅停止（如果 PID 文件存在）
if exist "%NGINX_PATH%\logs\nginx.pid" (
    cd /d "%NGINX_PATH%"
    nginx.exe -s quit 2>nul
    timeout /t 1 /nobreak >nul
)

REM 检查是否还有进程
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% equ 0 (
    echo    仍有进程运行，尝试强制停止...
    taskkill /F /IM nginx.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
)

REM 等待进程完全退出
echo    等待进程退出...
timeout /t 3 /nobreak >nul

REM 检查是否还有进程
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% equ 0 (
    echo    [警告] 仍有 Nginx 进程运行，尝试强制结束...
    taskkill /F /IM nginx.exe
    if %errorlevel% equ 0 (
        echo    强制结束成功
        timeout /t 2 /nobreak >nul
    ) else (
        echo    [错误] 强制结束失败
        pause
        exit /b 1
    )
) else (
    echo    正常退出成功
)

REM 再次检查
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo    Nginx 已停止
    echo ========================================
    echo.
) else (
    echo.
    echo [错误] Nginx 停止失败，仍有进程运行
    echo.
    tasklist /FI "IMAGENAME eq nginx.exe" /FO TABLE
    pause
    exit /b 1
)

echo 按任意键退出...
pause >nul 2>&1


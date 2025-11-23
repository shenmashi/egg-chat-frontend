@echo off
chcp 65001 >nul
echo ========================================
echo    Nginx 进程清理脚本
echo ========================================
echo.

REM 设置 Nginx 安装路径
set NGINX_PATH=C:\Program Files\nginx-1.28.0

echo [1/3] 检查 Nginx 进程...
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% neq 0 (
    echo    未发现 Nginx 进程
    echo.
    echo Nginx 未运行，无需清理
    pause
    exit /b 0
)

echo    发现 Nginx 进程，正在统计...
echo.
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq nginx.exe" /FO LIST ^| findstr /I "PID:"') do (
    echo     进程 PID: %%i
)

echo.
echo [2/3] 尝试优雅停止...
if exist "%NGINX_PATH%\logs\nginx.pid" (
    cd /d "%NGINX_PATH%"
    nginx.exe -s quit 2>nul
    timeout /t 2 /nobreak >nul
)

echo.
echo [3/3] 强制结束所有 Nginx 进程...
taskkill /F /IM nginx.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo    强制结束命令已执行
    timeout /t 2 /nobreak >nul
) else (
    echo    [警告] 结束进程时可能遇到错误
)

echo.
echo 验证清理结果...
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo    清理完成！所有 Nginx 进程已结束
    echo ========================================
    echo.
) else (
    echo.
    echo [警告] 仍有 Nginx 进程运行：
    tasklist /FI "IMAGENAME eq nginx.exe" /FO TABLE
    echo.
    echo 请手动检查并结束这些进程
)

echo 按任意键退出...
pause >nul 2>&1


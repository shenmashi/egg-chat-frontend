@echo off
chcp 65001 >nul
echo ========================================
echo    Nginx 重启脚本
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

echo [1/4] 检查 Nginx 进程...
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% equ 0 (
    echo    发现 Nginx 进程正在运行
    echo.
    echo [2/4] 停止 Nginx...
    REM 先尝试优雅停止（如果 PID 文件存在）
    if exist "%NGINX_PATH%\logs\nginx.pid" (
        cd /d "%NGINX_PATH%"
        nginx.exe -s quit 2>nul
        timeout /t 1 /nobreak >nul
    )
    
    REM 检查是否还有进程，有则强制结束
    tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
    if %errorlevel% equ 0 (
        echo    仍有进程运行，强制结束所有 Nginx 进程...
        taskkill /F /IM nginx.exe >nul 2>&1
        timeout /t 2 /nobreak >nul
    )
    
    REM 再次检查
    tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
    if %errorlevel% equ 0 (
        echo    [警告] 仍有进程未结束，等待 3 秒后继续...
        timeout /t 3 /nobreak >nul
    ) else (
        echo    所有进程已停止
    )
) else (
    echo    未发现 Nginx 进程
    echo.
    echo [2/4] 跳过停止步骤
)

echo.
echo [3/4] 测试配置文件...
nginx.exe -t
if %errorlevel% neq 0 (
    echo.
    echo [错误] 配置文件测试失败！
    echo 请检查配置文件后重试
    pause
    exit /b 1
)

echo.
echo [4/4] 启动 Nginx...
start /B nginx.exe

REM 等待启动
timeout /t 2 /nobreak >nul

REM 验证是否启动成功
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo    Nginx 重启成功！
    echo ========================================
    echo.
    echo 进程信息:
    tasklist /FI "IMAGENAME eq nginx.exe" /FO TABLE
    echo.
    echo 监听端口:
    netstat -ano 2>nul | findstr ":80" 2>nul | findstr "LISTENING" 2>nul
    netstat -ano 2>nul | findstr ":8989" 2>nul | findstr "LISTENING" 2>nul
    echo.
) else (
    echo.
    echo [错误] Nginx 启动失败！
    echo 请检查错误日志: %NGINX_PATH%\logs\error.log
    pause
    exit /b 1
)

echo 按任意键退出...
pause >nul 2>&1


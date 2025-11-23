@echo off
chcp 65001 >nul
echo ========================================
echo    Nginx 重载配置脚本
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

echo [1/3] 检查 Nginx 进程...
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% neq 0 (
    echo    未发现 Nginx 进程
    echo.
    echo [信息] Nginx 未运行，将启动 Nginx...
    goto start_nginx
)

echo    发现 Nginx 进程正在运行
echo.
echo [2/3] 测试配置文件...
nginx.exe -t
if %errorlevel% neq 0 (
    echo.
    echo [错误] 配置文件测试失败！
    echo 请检查配置文件后重试
    pause
    exit /b 1
)

echo.
echo [3/3] 重载配置...
nginx.exe -s reload
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo    配置重载成功！
    echo ========================================
    echo.
    echo 进程信息:
    tasklist /FI "IMAGENAME eq nginx.exe" /FO TABLE
    echo.
) else (
    echo.
    echo [错误] 配置重载失败！
    echo 尝试重启 Nginx...
    nginx.exe -s stop
    timeout /t 2 /nobreak >nul
    start /B nginx.exe
    timeout /t 2 /nobreak >nul
    tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
    if %errorlevel% equ 0 (
        echo    重启成功
    ) else (
        echo    重启失败，请检查错误日志: %NGINX_PATH%\logs\error.log
        pause
        exit /b 1
    )
)

echo 按任意键退出...
pause >nul 2>&1
exit /b 0

:start_nginx
echo.
echo [2/2] 测试配置文件...
nginx.exe -t
if %errorlevel% neq 0 (
    echo.
    echo [错误] 配置文件测试失败！
    echo 请检查配置文件后重试
    pause
    exit /b 1
)

echo.
echo [3/2] 启动 Nginx...
start /B nginx.exe
timeout /t 2 /nobreak >nul

tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo    Nginx 启动成功！
    echo ========================================
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


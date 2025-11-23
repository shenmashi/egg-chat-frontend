@echo off
chcp 65001 >nul
echo ========================================
echo    Nginx 状态检查
echo ========================================
echo.

REM 设置 Nginx 安装路径（根据实际情况修改）
set NGINX_PATH=C:\Program Files\nginx-1.28.0

echo [1/4] 检查 Nginx 进程...
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | find /I "nginx.exe" >nul
if %errorlevel% equ 0 (
    echo    状态: 正在运行
    echo.
    echo    进程信息:
    tasklist /FI "IMAGENAME eq nginx.exe" /FO TABLE
    echo.
) else (
    echo    状态: 未运行
    echo.
    echo    [提示] 使用 nginx-start.bat 启动 Nginx
    echo.
)

echo [2/4] 检查 PID 文件...
if exist "%NGINX_PATH%\logs\nginx.pid" (
    echo    状态: PID 文件存在
    type "%NGINX_PATH%\logs\nginx.pid"
    echo.
) else (
    echo    状态: PID 文件不存在（Nginx 可能未正常启动）
    echo.
)

echo [3/4] 检查监听端口...
echo    监听端口:
netstat -ano 2>nul | findstr "LISTENING" 2>nul | findstr ":80 :8989 :443" 2>nul
if errorlevel 1 (
    echo    （未发现 Nginx 相关端口）
)
echo.

echo [4/4] 检查配置文件...
cd /d "%NGINX_PATH%"
nginx.exe -t 2>&1
echo.

echo ========================================
echo    检查完成
echo ========================================
echo.
echo 常用命令:
echo   - 启动: nginx-start.bat
echo   - 停止: nginx-stop.bat
echo   - 重启: nginx-restart.bat
echo   - 重载: nginx-reload.bat
echo.
pause


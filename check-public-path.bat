@echo off
chcp 65001 >nul
echo ========================================
echo    检查 /public 路径配置
echo ========================================
echo.

echo [1] 检查 Nginx 配置语法...
echo.

REM 查找 Nginx 安装路径
set NGINX_PATH=
if exist "C:\Program Files\nginx-1.28.0\nginx.exe" (
    set NGINX_PATH=C:\Program Files\nginx-1.28.0
) else if exist "C:\nginx\nginx.exe" (
    set NGINX_PATH=C:\nginx
) else if exist "D:\nginx\nginx.exe" (
    set NGINX_PATH=D:\nginx
) else (
    echo [错误] 未找到 Nginx，请手动设置 NGINX_PATH 变量
    pause
    exit /b 1
)

echo    找到 Nginx: %NGINX_PATH%
echo.

cd /d "%NGINX_PATH%"
nginx.exe -t
if %errorlevel% neq 0 (
    echo.
    echo [错误] Nginx 配置语法错误，请检查配置文件
    pause
    exit /b 1
)

echo.
echo [2] 检查后端服务器是否运行 (localhost:7001)...
echo.
netstat -an | findstr ":7001" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo    [警告] 后端服务器 (localhost:7001) 可能未运行
    echo    请确保后端服务正在运行
) else (
    echo    [成功] 检测到端口 7001 正在监听
)

echo.
echo [3] 测试路径配置...
echo.
echo    当前配置：
echo    - 前端请求: http://qhkf.qh1851.com:8989/public/uploads/chat/xxx.png
echo    - Nginx 代理到: http://localhost:7001/public/uploads/chat/xxx.png
echo.
echo    如果后端路径不同，可能需要修改 Nginx 配置中的 proxy_pass
echo.

echo [4] 常见问题排查：
echo.
echo    a) 如果后端路径是 /uploads/ 而不是 /public/uploads/
echo       需要修改 proxy_pass 为: http://localhost:7001/uploads/
echo.
echo    b) 如果后端路径完全匹配，但仍 404
echo       请检查后端服务器是否正确配置了静态文件服务
echo.
echo    c) 如果返回 500 错误
echo       请检查 Nginx 错误日志: %NGINX_PATH%\logs\error.log
echo.

echo ========================================
echo    检查完成
echo ========================================
echo.
pause


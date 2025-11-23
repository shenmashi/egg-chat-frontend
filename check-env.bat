@echo off
chcp 65001 >nul
echo ========================================
echo    环境变量检查脚本
echo ========================================
echo.

echo [1/3] 检查系统环境变量...
echo.
echo REACT_APP_API_BASE_URL:
set REACT_APP_API_BASE_URL 2>nul
if errorlevel 1 (
    echo    未设置（正确）
) else (
    echo    已设置: %REACT_APP_API_BASE_URL%
    echo    [警告] 需要清除此环境变量！
)
echo.

echo REACT_APP_SOCKET_URL:
set REACT_APP_SOCKET_URL 2>nul
if errorlevel 1 (
    echo    未设置（正确）
) else (
    echo    已设置: %REACT_APP_SOCKET_URL%
    echo    [警告] 需要清除此环境变量！
)
echo.

echo [2/3] 检查 .env 文件...
if exist ".env" (
    echo    发现 .env 文件
    findstr /C:"REACT_APP_API_BASE_URL" .env 2>nul
    findstr /C:"REACT_APP_SOCKET_URL" .env 2>nul
) else (
    echo    未发现 .env 文件
)
echo.

if exist ".env.production" (
    echo    发现 .env.production 文件
    findstr /C:"REACT_APP_API_BASE_URL" .env.production 2>nul
    findstr /C:"REACT_APP_SOCKET_URL" .env.production 2>nul
) else (
    echo    未发现 .env.production 文件
)
echo.

if exist ".env.development" (
    echo    发现 .env.development 文件
    findstr /C:"REACT_APP_API_BASE_URL" .env.development 2>nul
    findstr /C:"REACT_APP_SOCKET_URL" .env.development 2>nul
) else (
    echo    未发现 .env.development 文件
)
echo.

echo [3/3] 解决方案...
echo.
echo 如果发现环境变量被设置，请执行以下操作：
echo.
echo 方法 1: 在当前会话清除（临时）
echo   set REACT_APP_API_BASE_URL=
echo   set REACT_APP_SOCKET_URL=
echo   npm run build
echo.
echo 方法 2: 清除系统环境变量（永久）
echo   1. 右键"此电脑" - "属性"
echo   2. "高级系统设置" - "环境变量"
echo   3. 在"用户变量"或"系统变量"中删除 REACT_APP_API_BASE_URL
echo   4. 重新打开命令提示符
echo   5. npm run build
echo.
echo 方法 3: 使用构建脚本（推荐）
echo   .\build-frontend.bat
echo.

pause


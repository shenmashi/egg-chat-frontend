const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
    console.log('🔧 setupProxy.js 正在加载...');

    // API代理
    app.use(
        '/napi',
        createProxyMiddleware({
            target: 'http://localhost:7001',
            changeOrigin: true,
            secure: false,
            onProxyReq: (proxyReq, req, res) => {
                // 从请求头中获取Authorization，而不是从localStorage
                const authHeader = req.headers.authorization;
                if (authHeader) {
                    proxyReq.setHeader('Authorization', authHeader);
                }
                console.log(`🔄 API代理: ${req.method} ${req.url} -> http://localhost:7001${req.url}`);
            },
            onError: (err, req, res) => {
                console.error('❌ API代理错误:', err.message);
            }
        })
    );

    // Socket.IO代理（支持WebSocket升级）
    const socketProxy = createProxyMiddleware({
        target: 'http://localhost:7001',
        changeOrigin: true,
        ws: true, // 启用WebSocket代理
        secure: false,
        logLevel: 'debug', // 开启调试日志
        onProxyReq: (proxyReq, req, res) => {
            console.log(`🔄 Socket.IO代理请求: ${req.method} ${req.url} -> http://localhost:7001${req.url}`);
        },
        onProxyReqWs: (proxyReq, req, socket, options, head) => {
            console.log('🔄 Socket.IO WebSocket升级请求');
            console.log(`   请求路径: ${req.url}`);
            console.log(`   目标: http://localhost:7001${req.url}`);
        },
        onProxyRes: (proxyRes, req, res) => {
            console.log(`✅ Socket.IO代理响应: ${req.url} -> ${proxyRes.statusCode}`);
        },
        onError: (err, req, res) => {
            console.error('❌ Socket.IO代理错误:', err.message);
            console.error('   请求URL:', req.url);
            console.error('   错误堆栈:', err.stack);
        },
        onOpen: (proxySocket) => {
            console.log('✅ Socket.IO WebSocket连接已建立');
        },
        onClose: (res, socket, head) => {
            console.log('❌ Socket.IO WebSocket连接已关闭');
        }
    });

    app.use('/socket.io', socketProxy);

    console.log('✅ setupProxy.js 加载完成');
};
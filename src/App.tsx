import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import Loading from './components/Loading';
import socketService from './services/socket';

const Login = React.lazy(() => import('./components/Login'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const UserDashboard = React.lazy(() => import('./components/UserDashboard'));

// 设置dayjs为中文
dayjs.locale('zh-cn');

// 路由守卫组件
const ProtectedRoute: React.FC<{ children: React.ReactNode; role?: string }> = ({ children, role }) => {
  const customerServiceToken = localStorage.getItem('customerServiceToken');
  const userToken = localStorage.getItem('userToken');
  
  if (role === 'customer_service' && !customerServiceToken) {
    return <Navigate to="/login" replace />;
  }
  
  if (role === 'user' && !userToken) {
    return <Navigate to="/login" replace />;
  }
  
  if (!customerServiceToken && !userToken) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  useEffect(() => {
    // 检查是否有token，如果有则连接Socket.IO
    const customerServiceToken = localStorage.getItem('customerServiceToken');
    const userToken = localStorage.getItem('userToken');
    
    if (customerServiceToken) {
      // 客服连接Socket.IO
      socketService.connect(customerServiceToken);
      
      // 监听客服登录成功事件
      socketService.on('login_success', (data) => {
        console.log('客服登录成功:', data);
      });

      socketService.on('login_error', (data) => {
        console.error('客服登录失败:', data);
        localStorage.removeItem('customerServiceToken');
        localStorage.removeItem('userRole');
        window.location.href = '/login';
      });
    } else if (userToken) {
      // 用户连接Socket.IO
      socketService.connect(userToken);
    }

    // 监听Socket.IO连接状态
    socketService.on('connect', () => {
      console.log('Socket.IO连接成功');
      
      // 连接成功后，如果是客服则发送登录请求
      if (customerServiceToken) {
        console.log('发送客服登录请求');
        socketService.customerServiceLogin(customerServiceToken);
      }
      
      // 如果是用户，发送用户登录请求
      if (userToken) {
        console.log('用户Socket连接成功，发送用户登录请求');
        socketService.userLogin(userToken);
      }
    });

    socketService.on('disconnect', () => {
      console.log('Socket.IO连接断开');
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <div className="App">
          <Suspense fallback={<Loading fullscreen tip="页面加载中..." />}> 
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute role="customer_service">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/user-dashboard"
              element={
                <ProtectedRoute role="user">
                  <UserDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
          </Suspense>
        </div>
      </Router>
    </ConfigProvider>
  );
};

export default App;
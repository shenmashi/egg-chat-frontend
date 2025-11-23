import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, message, Space, Tabs } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, CustomerServiceOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { customerServiceAPI, userAPI } from '../services/api';
import socketService from '../services/socket';
import Loading from './Loading';

const { Title, Text } = Typography;

interface LoginFormData {
  username: string;
  password: string;
  role: 'customer_service' | 'user';
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('customer_service');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 处理外部系统跳转：自动注册和登录
  useEffect(() => {
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    debugger;
    if (userId && userName) {
      console.log('🔗 检测到外部系统跳转参数:', { userId, userName });
      
      // 自动注册和登录
      handleAutoRegisterAndLogin(userId, userName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自动注册和登录处理
  const handleAutoRegisterAndLogin = async (userId: string, userName: string) => {
    setLoading(true);
    
    try {
      // random + userId
      const username = `random${userId}`;
      
      // 默认密码策略（可以根据需要修改）
      const defaultPassword = `random${userId}@123`;
      
      // 生成邮箱（如果没有提供）
      const email = `${username}@random.com`;
      
      console.log('📝 开始自动注册:', { username, email, realName: userName });
      
      // 尝试注册
      try {
        const registerResponse = await userAPI.register({
          username,
          email,
          password: defaultPassword,
          realName: userName
        });
        
        if (registerResponse?.data?.code === 200) {
          console.log('✅ 自动注册成功');
          // message.success('自动注册成功，正在登录...');
        } else {
          // 如果用户已存在，继续尝试登录
          if (registerResponse?.data?.code === 400 || registerResponse?.data?.message?.includes('已存在')) {
            console.log('ℹ️ 用户已存在，跳过注册，直接登录');
          } else {
            throw new Error(registerResponse?.data?.message || '注册失败');
          }
        }
      } catch (registerError: any) {
        // 如果用户已存在，继续尝试登录
        if (registerError?.response?.data?.code === 400 || 
            registerError?.response?.data?.message?.includes('已存在') ||
            registerError?.response?.data?.message?.includes('exists')) {
          console.log('ℹ️ 用户已存在，跳过注册，直接登录');
        } else {
          console.error('❌ 注册失败:', registerError);
          message.error('自动注册失败，请手动登录');
          setLoading(false);
          return;
        }
      }
      
      // 自动登录
      console.log('🔐 开始自动登录:', { username });
      const loginResponse = await userAPI.login({
        username,
        password: defaultPassword
      });
      if (loginResponse && loginResponse.data.code === 200 && loginResponse?.data?.data) {
        // 保存token和角色信息
        const token = loginResponse?.data?.data?.token;
        const userInfo = loginResponse?.data?.data?.user || loginResponse?.data?.data;
        localStorage.setItem('userToken', token);
        localStorage.setItem('userRole', 'user');
        
        // 保存用户信息到 localStorage，以便在加载失败时恢复
        if (userInfo && (userInfo.id || userInfo.username)) {
          localStorage.setItem('userInfo', JSON.stringify(userInfo));
          console.log('💾 已保存用户信息到 localStorage:', userInfo);
        }
        
        // 连接Socket.IO
        socketService.connect(token);
        socketService.userLogin(token);
        
        // 设置自动登录标记，用于跳过自动连接客服
        localStorage.setItem('autoLoginSkipConnect', 'true');
        console.log('🔖 设置自动登录标记，跳过自动连接客服');
        
        message.success('自动登录成功');
        
        // 清除URL参数
        setSearchParams({});
        
        // 跳转到用户仪表板
        navigate('/user-dashboard');
      } else {
        message.error(loginResponse?.data?.message || '自动登录失败');
      }
    } catch (error: any) {
      console.error('❌ 自动注册登录失败:', error);
      message.error(error.response?.data?.message || '自动注册登录失败，请手动登录');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: LoginFormData) => {
    setLoading(true);
    try {
      let response;
      
      if (values.role === 'customer_service') {
        // 客服登录
        response = await customerServiceAPI.login({
          username: values.username,
          password: values.password
        });
        
        if (response && response.code === 200 && response?.data) {
          // 保存token和角色信息
          localStorage.setItem('customerServiceToken', response?.data?.token);
          localStorage.setItem('userRole', 'customer_service');
          
          // 连接Socket.IO
          socketService.connect(response?.data?.token);
          socketService.customerServiceLogin(response?.data?.token);
          
          message.success('客服登录成功');
          navigate('/dashboard');
        } else {
          message.error(response?.message || '登录失败');
        }
      } else {
        // 普通用户登录
        response = await userAPI.login({
          username: values.username,
          password: values.password
        });
        
        if (response && response.data.code === 200 && response?.data?.data) {
          // 保存token和角色信息
          const token = response?.data?.data?.token;
          const userInfo = response?.data?.data?.user || response?.data?.data;
          localStorage.setItem('userToken', token);
          localStorage.setItem('userRole', 'user');
          
          // 保存用户信息到 localStorage，以便在加载失败时恢复
          if (userInfo && (userInfo.id || userInfo.username)) {
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
            console.log('💾 已保存用户信息到 localStorage:', userInfo);
          }
          
          // 连接Socket.IO
          socketService.connect(token);
          socketService.userLogin(token);
          
          message.success('用户登录成功');
          navigate('/user-dashboard');
        } else {
          message.error(response?.data?.message || '登录失败');
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 检查是否有外部系统跳转参数
  const hasExternalParams = searchParams.get('userId') && searchParams.get('userName');
  
  // 如果是自动登录，显示全屏加载
  if (loading && hasExternalParams) {
    return <Loading fullscreen tip="正在自动注册并登录，请稍候..." />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Card
        style={{
          borderRadius: '16px',
          border: 'none',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <LoginOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              系统登录
            </Title>
            <Text type="secondary">
              请选择您的身份进行登录
            </Text>
          </div>
           
          {/* 如果有外部系统跳转参数，隐藏登录表单 */}
          {!hasExternalParams && (
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              centered
              items={[
              {
                key: 'customer_service',
                label: (
                  <span>
                    <CustomerServiceOutlined />
                    客服登录
                  </span>
                ),
                children: (
                  <Form
                    name="customerServiceLogin"
                    onFinish={(values) => onFinish({ ...values, role: 'customer_service' })}
                    autoComplete="off"
                    size="large"
                  >
                    <Form.Item
                      name="username"
                      initialValue="testcs"
                      rules={[
                        { required: true, message: '请输入用户名或邮箱' },
                      ]}
                    >
                      <Input
                        prefix={<UserOutlined />}
                        placeholder="用户名或邮箱"
                        style={{ borderRadius: '8px' }}
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      initialValue="123456"
                      rules={[
                        { required: true, message: '请输入密码' },
                      ]}
                    >
                      <Input.Password
                        prefix={<LockOutlined />}
                        placeholder="密码"
                        style={{ borderRadius: '8px' }}
                      />
                    </Form.Item>

                    <Form.Item>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        style={{
                          width: '100%',
                          height: '48px',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: 'bold'
                        }}
                      >
                        客服登录
                      </Button>
                    </Form.Item>
                  </Form>
                )
              },
              {
                key: 'user',
                label: (
                  <span>
                    <TeamOutlined />
                    用户登录
                  </span>
                ),
                children: (
                  <Form
                    name="userLogin"
                    onFinish={(values) => onFinish({ ...values, role: 'user' })}
                    autoComplete="off"
                    size="large"
                  >
                    <Form.Item
                      name="username"
                      initialValue="testuser"
                      rules={[
                        { required: true, message: '请输入用户名或邮箱' },
                      ]}
                    >
                      <Input
                        prefix={<UserOutlined />}
                        placeholder="用户名或邮箱"
                        style={{ borderRadius: '8px' }}
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      initialValue="123456"
                      rules={[
                        { required: true, message: '请输入密码' },
                      ]}
                    >
                      <Input.Password
                        prefix={<LockOutlined />}
                        placeholder="密码"
                        style={{ borderRadius: '8px' }}
                      />
                    </Form.Item>

                    <Form.Item>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        style={{
                          width: '100%',
                          height: '48px',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: 'bold'
                        }}
                      >
                        用户登录
                      </Button>
                    </Form.Item>
                  </Form>
                )
              }
            ]}
            />
          )}

          {/* 如果有外部系统跳转参数，显示提示信息 */}
          {hasExternalParams && !loading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                正在处理自动登录，请稍候...
              </Text>
            </div>
          )}

          {/* 如果没有外部参数，显示注册提示 */}
          {!hasExternalParams && (
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                还没有账号？请联系管理员注册
              </Text>
            </div>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default Login;

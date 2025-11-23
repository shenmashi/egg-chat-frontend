import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layout,
  Card,
  Avatar,
  Typography,
  Button,
  Space,
  Dropdown,
  Menu,
  message,
  Modal,
  Form,
  Input,
  Upload,
  List,
  Tag,
  Tooltip
} from 'antd';
import {
  UserOutlined,
  MessageOutlined,
  LogoutOutlined,
  CameraOutlined,
  EditOutlined,
  ClockCircleOutlined,
  WifiOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { userAPI } from '../services/api';
import socketService from '../services/socket';
import ChatInterface from './ChatInterface';
import { getImageUrl } from '../utils/url';
import Loading from './Loading';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const UserDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileForm] = Form.useForm();
  const [isConnected, setIsConnected] = useState(false);
  // 消息状态已移至ChatInterface组件处理
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [modal, contextHolder] = Modal.useModal();
  const [customerServiceInfo, setCustomerServiceInfo] = useState<any>(null);
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [allCustomerServices, setAllCustomerServices] = useState<any[]>([]);

  // 响应式：移动端与侧边栏折叠
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  // 标记“用户正在手动切换会话”，用于短时间内避免被 socket 推送覆盖
  const manualSelectingRef = useRef<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarCollapsed(mobile ? true : false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 使用ref保存易变的依赖，避免将其放入effect依赖数组
  const currentSessionRef = useRef<any>(null);
  const userIdRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user]);

  // 加载用户信息
  const loadUser = useCallback(async () => {
    try {
      console.log('🔍 开始加载用户信息...');
      const userToken = localStorage.getItem('userToken');
      if (!userToken) {
        console.warn('⚠️ 未找到用户 Token，跳转到登录页');
        navigate('/login');
        return;
      }
      
      const response = await userAPI.getProfile();
      console.log('📥 用户信息 API 完整响应:', response);
      console.log('📥 response.data:', response?.data);
      console.log('📥 response.data?.code:', response?.data?.code);
      console.log('📥 response.data?.data:', response?.data?.data);
      
      // 处理不同的响应格式
      let userData = null;
      if (response?.data?.code === 200 && response?.data?.data) {
        userData = response.data.data;
      } else if (response?.data?.code === 200 && response?.data) {
        // 如果 code 是 200 但 data 字段就是用户信息本身
        userData = response.data;
      } else if (response?.data?.data) {
        // 如果直接返回 data
        userData = response.data.data;
      } else if (response?.data && typeof response.data === 'object' && 'id' in response.data) {
        // 如果 data 就是用户信息（有 id 字段）
        userData = response.data;
      }
      
      if (userData && (userData.id || userData.username)) {
        console.log('✅ 用户信息加载成功:', userData);
        setUser(userData);
        profileForm.setFieldsValue({
          realName: userData.username || userData.realName || '',
        });
      } else {
        console.warn('⚠️ 用户信息为空或格式不正确，响应:', response);
        console.warn('⚠️ 尝试从 response 中提取用户信息...');
        
        // 尝试从登录响应中获取用户信息（如果之前保存过）
        const loginData = localStorage.getItem('userInfo');
        if (loginData) {
          try {
            const parsed = JSON.parse(loginData);
            console.log('📦 从 localStorage 恢复用户信息:', parsed);
            setUser(parsed);
            return;
          } catch (e) {
            console.error('解析 localStorage 用户信息失败:', e);
          }
        }
        
        // 如果所有方法都失败，设置一个占位对象，避免一直显示 loading
        console.warn('⚠️ 设置占位用户信息，避免一直显示 loading');
        setUser({ id: 0, username: 'User', email: '' });
        message.warning('用户信息加载异常，但可以继续使用');
      }
    } catch (error: any) {
      console.error('❌ 加载用户信息失败:', error);
      console.error('错误详情:', error?.response?.data || error?.message || error);
      
      // 检查是否是认证错误
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        console.warn('⚠️ 认证失败，清除 Token 并跳转到登录页');
        localStorage.removeItem('userToken');
        localStorage.removeItem('userRole');
        navigate('/login');
        return;
      }
      
      message.error(t('dashboard.loadFailed') || '加载用户信息失败');
      
      // 尝试从 localStorage 恢复用户信息
      const loginData = localStorage.getItem('userInfo');
      if (loginData) {
        try {
          const parsed = JSON.parse(loginData);
          console.log('📦 从 localStorage 恢复用户信息（错误恢复）:', parsed);
          setUser(parsed);
          return;
        } catch (e) {
          console.error('解析 localStorage 用户信息失败:', e);
        }
      }
      
      // 如果所有方法都失败，设置一个占位对象，避免一直显示 loading
      const userToken = localStorage.getItem('userToken');
      if (userToken) {
        console.warn('⚠️ 有 Token 但加载失败，设置占位用户信息');
        setUser({ id: 0, username: 'User', email: '' });
      } else {
        navigate('/login');
      }
    }
  }, [profileForm, t, navigate]);

  // 加载历史会话
  const loadHistorySessions = useCallback(async () => {
    try {
      const response = await userAPI.getHistorySessions();
      if (response.data.code === 200) {
        setHistorySessions(response.data.data?.list || []);
      }
    } catch (error) {
      console.error('加载历史会话失败:', error);
    }
  }, []);

  // 加载所有客服列表
  const loadAllCustomerServices = useCallback(async () => {
    try {
      const response = await userAPI.getAllCustomerServices();
      if (response.data.code === 200) {
        setAllCustomerServices(response.data.data || []);
      }
    } catch (error) {
      console.error('加载客服列表失败:', error);
    }
  }, []);


  // 查看历史会话 - 直接进入聊天界面（并补齐必要字段、加入房间）
  const handleViewHistorySession = (session: any) => {
    console.log('用户选择历史会话:', session);
    manualSelectingRef.current = true;
    const sessionId = session.sessionId || session.session_id;
    const userId = session.userId || session.user_id || user?.id;
    const normalized = {
      sessionId,
      session_id: sessionId,
      userId,
      user_id: userId,
      customerServiceId: session.customerServiceId || session.customer_service_id,
      status: 'active',
      username: session.username || session.userName
    };
    setCurrentSession(normalized);
    
    // 移动端：打开聊天界面后自动关闭侧边栏
    if (isMobile) {
      setSidebarCollapsed(true);
    }
    
    // 让用户加入会话房间，确保能接收消息
    if (socketService.isConnected() && sessionId) {
      socketService.joinRoom(`session_${sessionId}`);
    }
    message.success(t('dashboard.enteredChatInterface'));
    // 1 秒后允许其他事件覆盖
    setTimeout(() => { manualSelectingRef.current = false; }, 1000);
  };

  // 直接与客服聊天
  const handleDirectChat = async (customerService: any) => {
    console.log('💬 用户选择与客服聊天:', customerService);
    
    if (!user?.id) {
      message.error(t('dashboard.userInfoNotLoaded'));
      return;
    }
    
    // 确保Socket已连接
    if (!socketService.isConnected()) {
      const userToken = localStorage.getItem('userToken');
      if (userToken) {
        console.log('💬 Socket未连接，自动连接...');
        socketService.connect(userToken);
        // 等待连接成功（最多等待5秒）
        let connected = false;
        for (let i = 0; i < 50; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (socketService.isConnected()) {
            connected = true;
            console.log('💬 Socket连接成功');
            // 发送登录请求
            socketService.userLogin(userToken);
            await new Promise(resolve => setTimeout(resolve, 500));
            break;
          }
        }
        
        if (!connected) {
          message.error(t('dashboard.connectionTimeout'));
          return;
        }
      } else {
        message.error(t('dashboard.tokenNotFound') || 'User token not found, please login again');
        return;
      }
    }
    
    // 确保用户已在Socket侧完成登录（后端依赖 socket.userType==='user'）
    const sock: any = socketService.getSocket();
    if (!sock || sock.userType !== 'user') {
      const userToken = localStorage.getItem('userToken');
      if (userToken) {
        console.log('💬 Socket已连接但尚未完成用户登录，开始登录...');
        const waitLogin = new Promise<void>((resolve) => {
          const handler = () => { try { socketService.off('user_login_success', handler); } catch {} resolve(); };
          socketService.on('user_login_success', handler);
          // 超时兜底
          setTimeout(() => { try { socketService.off('user_login_success', handler); } catch {} resolve(); }, 1000);
        });
        socketService.userLogin(userToken);
        await waitLogin;
      }
    }

    // 使用用户ID_客服ID格式的session_id
    const sessionId = `${user.id}_${customerService.id}`;
    console.log('💬 生成的会话ID:', sessionId);
    const newSession = {
      sessionId,
      session_id: sessionId,
      status: 'waiting', // 改为waiting，等待客服接受
      userId: user.id,
      customerServiceId: customerService.id,
      customerServiceName: customerService.username,
      message: t('chat.waitingForAccept')
    };
    
    console.log('💬 设置当前会话:', newSession);
    setCurrentSession(newSession);
    
    // 移动端：打开聊天界面后自动关闭侧边栏
    if (isMobile) {
      setSidebarCollapsed(true);
    }
    
    // 通过Socket发送开始聊天请求
    if (socketService.isConnected() && socketService.getSocket()) {
      console.log('💬 发送start_chat请求:', { 
        userId: user.id,
        customerServiceId: customerService.id
      });
      
      try {
        socketService.emit('start_chat', { 
          userId: user.id,
          customerServiceId: customerService.id
        }, (resp: any) => {
          console.log('💬 start_chat响应:', resp);
          if (resp && resp.ok) {
            console.log('💬 会话创建成功，sessionId:', resp.sessionId);
          } else if (resp && resp.error) {
            message.error(t('dashboard.chatRequestFailed') + ': ' + resp.error);
          }
        });
        
        // 用户加入会话房间以接收消息
        setTimeout(() => {
          if (socketService.getSocket()) {
            console.log('💬 用户尝试加入会话房间:', sessionId);
            socketService.joinRoom(`session_${sessionId}`);
            console.log('💬 用户加入会话房间请求已发送');
          } else {
            console.log('❌ Socket未连接，无法加入会话房间');
          }
        }, 500); // 延迟500ms确保后端处理完成
        
        message.success(t('dashboard.connectingCustomerService', { username: customerService.username }) || `Connecting to ${customerService.username}, waiting for acceptance`);
      } catch (error) {
        console.error('💬 发送start_chat失败:', error);
        message.error(t('dashboard.chatRequestFailed') || 'Failed to send chat request, please retry');
      }
    } else {
      console.log('❌ Socket连接失败，无法发送start_chat请求');
      message.error(t('dashboard.connectionFailed'));
    }
  };

  useEffect(() => {
    loadUser();
    loadHistorySessions();
    loadAllCustomerServices();
    
    // 检查初始连接状态并自动连接Socket
    const checkConnection = () => {
      const connected = socketService.isConnected();
      setIsConnected(connected);
      
      // 如果未连接且有token，自动连接
      if (!connected) {
        const userToken = localStorage.getItem('userToken');
        if (userToken) {
          console.log('用户端自动连接Socket...');
          socketService.connect(userToken);
          // 连接后发送用户登录请求
          setTimeout(() => {
            socketService.userLogin(userToken);
          }, 1000);
        }
      }
    };
    
    checkConnection();
    
    // 定期检查连接状态
    const connectionInterval = setInterval(checkConnection, 1000);
    
    // 定期刷新客服列表以确保状态同步（每30秒刷新一次，作为Socket事件的兜底）
    const refreshInterval = setInterval(() => {
      console.log('定期刷新客服列表以确保状态同步');
      loadAllCustomerServices();
    }, 30000);
    
    return () => {
      clearInterval(connectionInterval);
      clearInterval(refreshInterval);
    };
  }, [loadAllCustomerServices, loadHistorySessions, loadUser]);

  // 消息处理已移至ChatInterface组件

  // 监听Socket.IO事件
  useEffect(() => {
    console.log('🔧 设置用户端Socket事件监听器');
    
    // 自动连接Socket
    if (!socketService.isConnected()) {
      console.log('🔧 用户端Socket未连接，尝试连接');
      const userToken = localStorage.getItem('userToken');
      if (userToken) {
        console.log('🔧 找到用户Token，连接Socket');
        socketService.connect(userToken);
        socketService.userLogin(userToken);
        // 设置用户信息用于重连
        if (user?.id) {
          socketService.setUserInfo('user', user.id);
        }
      } else {
        console.log('🔧 未找到用户Token');
      }
    } else {
      console.log('🔧 用户端Socket已连接');
    }
    
    // 检查连接状态
    const checkConnection = () => {
      const connected = socketService.isConnected();
      // console.log('🔧 检查Socket连接状态:', connected);
      setIsConnected(connected);
    };
    
    // Socket连接成功事件
    const handleConnect = () => {
      console.log('✅ 用户端Socket连接成功');
      setIsConnected(true);
      // 连接成功后，如果还没有登录，发送登录请求
      const userToken = localStorage.getItem('userToken');
      if (userToken && socketService.getSocket()) {
        // 检查是否已经登录（通过socket.userId）
        const socket = socketService.getSocket();
        if (!socket.userId) {
          console.log('🔧 Socket连接成功，发送用户登录请求');
          socketService.userLogin(userToken);
        }
      }
      // Socket重连后，重新加载客服列表以确保状态同步
      loadAllCustomerServices();
    };

    // Socket断开连接事件
    const handleDisconnect = () => {
      console.log('❌ 用户端Socket连接断开');
      setIsConnected(false);
    };

    // Socket连接错误事件
    const handleConnectError = (error: any) => {
      console.error('❌ 用户端Socket连接错误:', error);
      setIsConnected(false);
    };
    
    checkConnection();
    
    // 监听Socket连接事件
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('connect_error', handleConnectError);
    
    // 定期检查连接状态（作为兜底）
    const interval = setInterval(checkConnection, 2000);

    // 会话开始
    const handleSessionStarted = (data: any) => {
      console.log('🚀 [用户端] ========== 收到session_started事件 ==========');
      console.log('🚀 [用户端] 事件数据:', JSON.stringify(data, null, 2));
      console.log('🚀 [用户端] 会话ID:', data.sessionId || data.session_id);
      console.log('🚀 [用户端] 会话状态:', data.status);
      console.log('🚀 [用户端] 当前会话状态（收到事件前）:', currentSessionRef.current);
      
      // 检查是否是自动登录，如果是则跳过自动连接客服
      const autoLoginSkipConnect = localStorage.getItem('autoLoginSkipConnect');
      if (autoLoginSkipConnect === 'true') {
        console.log('⚠️ [用户端] 忽略 session_started 事件，因为这是自动登录，不需要自动连接客服');
        // 清除标记，只在首次加载时生效
        localStorage.removeItem('autoLoginSkipConnect');
        return;
      }
      
      // 若用户刚手动切换了历史会话，临时忽略后端推送的 waiting 覆盖
      if (manualSelectingRef.current) {
        console.log('⚠️ [用户端] 忽略 session_started 覆盖，因为刚手动选择了历史会话');
        return;
      }
      
      // 确保所有必要字段都存在
      const sessionData = {
        sessionId: data.sessionId || data.session_id,
        session_id: data.session_id || data.sessionId,
        status: data.status || 'waiting',
        userId: data.userId || data.user_id || userIdRef.current,
        user_id: data.user_id || data.userId || userIdRef.current,
        customerServiceId: data.customerServiceId || data.customer_service_id,
        customer_service_id: data.customer_service_id || data.customerServiceId,
        message: data.message || t('dashboard.waitingForAgentAccess')
      };
      
      console.log('🚀 [用户端] 设置会话状态:', sessionData);
      setCurrentSession(sessionData);
      message.success(t('dashboard.waitingForAgentAccessNow'));
      console.log('✅ [用户端] 会话状态已设置为:', sessionData.status);
      
      // 用户加入会话房间以接收消息
      if (socketService.getSocket()) {
        const sessionIdToJoin = sessionData.sessionId || sessionData.session_id;
        console.log('🚀 [用户端] 尝试加入会话房间:', sessionIdToJoin);
        socketService.joinRoom(`session_${sessionIdToJoin}`);
        console.log('✅ [用户端] 用户加入会话房间请求已发送');
      } else {
        console.log('❌ [用户端] Socket未连接，无法加入会话房间');
      }
    };

    // 会话被客服接受
    const handleSessionAccepted = (data: any) => {
      console.log('✅ [用户端] ========== 收到session_accepted事件 ==========');
      console.log('✅ [用户端] 事件数据:', JSON.stringify(data, null, 2));
      
      const sessionId = data.sessionId || data.session_id;
      console.log('✅ [用户端] 会话ID:', sessionId);
      console.log('✅ [用户端] 客服ID:', data.customerServiceId || data.customer_service_id);
      console.log('✅ [用户端] 当前会话状态(ref):', currentSessionRef.current);
      
      // 验证会话ID是否匹配当前会话（如果不匹配，可能是旧会话的通知，需要处理）
      const currentSessionId = currentSessionRef.current?.sessionId || currentSessionRef.current?.session_id;
      if (currentSessionId && currentSessionId !== sessionId) {
        console.warn('⚠️ [用户端] 收到的session_accepted会话ID不匹配当前会话');
        console.warn('⚠️ [用户端] 当前会话ID:', currentSessionId);
        console.warn('⚠️ [用户端] 收到的会话ID:', sessionId);
        console.warn('⚠️ [用户端] 仍然切换为新接受的会话');
      }
      
      // 强制更新会话状态为active，确保能进入聊天界面
      // 使用广播数据中的所有字段，确保完整
      const acceptedSessionData = {
        sessionId: sessionId,
        session_id: sessionId,
        status: data.status || 'active', // 使用广播数据中的状态
        customerServiceId: data.customerServiceId || data.customer_service_id,
        customer_service_id: data.customer_service_id || data.customerServiceId,
        userId: userIdRef.current,
        user_id: userIdRef.current,
      };
      
      console.log('✅ [用户端] 设置会话状态为active:', acceptedSessionData);
      setCurrentSession(acceptedSessionData);
      
      // 移动端：会话被接受后自动关闭侧边栏
      if (isMobile) {
        setSidebarCollapsed(true);
      }
      
      // 设置客服信息
      setCustomerServiceInfo({
        id: data.customerServiceId || data.customer_service_id,
        name: data.customerServiceName || t('chat.customerService'),
        message: data.message || t('dashboard.sessionAcceptedByAgent')
      });
      
      // 重新加入会话房间以接收消息
      if (socketService.getSocket()) {
        console.log('✅ [用户端] 用户重新加入会话房间:', sessionId);
        socketService.joinRoom(`session_${sessionId}`);
        console.log('✅ [用户端] 用户重新加入会话房间请求已发送');
      } else {
        console.log('❌ [用户端] Socket未连接，无法重新加入会话房间');
      }

      message.success(t('dashboard.agentConnectedStartChat'));
      console.log('✅ [用户端] 会话接受处理完成');
    };

    // 客服状态更新（在线/忙碌/离线）
    const handleCustomerServiceStatus = (data: any) => {
      console.log('客服状态更新:', data);
      if (!data) return;
      setAllCustomerServices(prev => {
        const list = Array.isArray(prev) ? [...prev] : [] as any[];
        const idx = list.findIndex((cs: any) => cs.id === data.customerServiceId || cs.id === data.id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], status: data.status || 'online' };
        }
        return list;
      });
    };

    // 连接测试
    const handlePong = (data: any) => {
      console.log('收到pong响应:', data);
    };

    // 会话重连
    const handleSessionReconnected = (data: any) => {
      console.log('用户端收到session_reconnected事件:', data);
      
      // 检查是否是自动登录，如果是则跳过自动连接客服
      const autoLoginSkipConnect = localStorage.getItem('autoLoginSkipConnect');
      if (autoLoginSkipConnect === 'true') {
        console.log('⚠️ [用户端] 忽略 session_reconnected 事件，因为这是自动登录，不需要自动连接客服');
        // 清除标记，只在首次加载时生效
        localStorage.removeItem('autoLoginSkipConnect');
        return;
      }
      
      setCurrentSession({
        sessionId: data.sessionId,
        session_id: data.sessionId,
        status: data.status,
        userId: data.userId
      });
      message.info(t('dashboard.sessionReconnected'));
      
      // 消息加载已移至ChatInterface组件处理
    };

    // 用户登录成功
    const handleUserLoginSuccess = (data: any) => {
      console.log('用户端收到user_login_success事件:', data);
      console.log('用户端Socket登录成功，userId:', data.userId);
      
      if (data.hasActiveSession) {
        message.info(t('dashboard.activeSessionReconnecting'));
      } else {
        message.success(t('dashboard.socketConnectedSuccess'));
      }
    };

    // 客服上线通知
    const handleCustomerServiceOnline = (data: any) => {
      console.log('用户端收到客服上线通知:', data);
      if (!data) return;
      setAllCustomerServices(prev => {
        const list = Array.isArray(prev) ? [...prev] : [] as any[];
        const idx = list.findIndex((cs: any) => cs.id === data.customerServiceId);
        if (idx >= 0) {
          list[idx] = { ...list[idx], status: 'online' };
        } else {
          list.unshift({ id: data.customerServiceId, username: data.username, status: 'online' });
        }
        return list;
      });
    };

    // 客服下线通知
    const handleCustomerServiceOffline = (data: any) => {
      console.log('用户端收到客服下线通知:', data);
      if (!data) return;
      setAllCustomerServices(prev => {
        const list = Array.isArray(prev) ? [...prev] : [] as any[];
        const idx = list.findIndex((cs: any) => cs.id === data.customerServiceId || cs.id === data.id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], status: 'offline' };
        }
        return list;
      });
    };

    // 会话被拒绝
    const handleSessionRejected = (data: any) => {
      console.log('用户端收到session_rejected事件:', data);
      // 清理当前会话状态
      setCurrentSession(null);
      setCustomerServiceInfo(null);
      message.error(t('dashboard.sessionRejectedByAgent'));
    };

    // 消息处理已移至ChatInterface组件
    
    // 测试事件监听器是否工作
    console.log('🔧 测试：发送一个测试事件');
    setTimeout(() => {
      console.log('🔧 测试：模拟发送new_message事件');
      if (socketService.getSocket()) {
        socketService.getSocket().emit('test_message', { test: true });
      }
    }, 2000);
    console.log('🔧 绑定session_started事件监听器');
    socketService.on('session_started', handleSessionStarted);
    console.log('🔧 绑定session_accepted事件监听器');
    socketService.on('session_accepted', handleSessionAccepted);
    console.log('🔧 绑定customer_service_status事件监听器');
    socketService.on('customer_service_status', handleCustomerServiceStatus);
    console.log('🔧 绑定pong事件监听器');
    socketService.on('pong', handlePong);
    console.log('🔧 绑定session_reconnected事件监听器');
    socketService.on('session_reconnected', handleSessionReconnected);
    socketService.on('user_login_success', handleUserLoginSuccess);
    socketService.on('session_rejected', handleSessionRejected);
    socketService.on('customer_service_online', handleCustomerServiceOnline);
    socketService.on('customer_service_offline', handleCustomerServiceOffline);
    socketService.on('session_joined', (data) => {
      console.log('用户端成功加入会话房间:', data);
    });

    // 监听会话结束事件
    socketService.on('session_ended', (data) => {
      console.log('用户端收到会话结束事件:', data);
      
      // 如果当前会话被结束，清空当前会话
      if (currentSession && (currentSession.session_id === data.sessionId || currentSession.sessionId === data.sessionId)) {
        setCurrentSession(null);
        setCustomerServiceInfo(null);
        const endedBy = data.endedBy?.type === 'customer_service' ? t('chat.customerService') : t('dashboard.you');
        message.info(t('dashboard.sessionEndedBy', { who: endedBy }));
      }
    });

    return () => {
      console.log('清理用户端Socket事件监听器');
      clearInterval(interval);
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('connect_error', handleConnectError);
      socketService.off('session_started', handleSessionStarted);
      socketService.off('session_accepted', handleSessionAccepted);
      socketService.off('customer_service_status', handleCustomerServiceStatus);
      socketService.off('pong', handlePong);
      socketService.off('session_reconnected', handleSessionReconnected);
      socketService.off('user_login_success', handleUserLoginSuccess);
      socketService.off('session_rejected', handleSessionRejected);
      socketService.off('customer_service_online', handleCustomerServiceOnline);
      socketService.off('customer_service_offline', handleCustomerServiceOffline);
      socketService.off('session_ended');
    };
  }, [currentSession, loadAllCustomerServices, user?.id]);

  // 测试连接
  const handleTestConnection = () => {
    if (socketService.isConnected()) {
      socketService.testConnection();
      message.info(t('dashboard.testConnection') + ' sent');
    } else {
      message.error(t('dashboard.notConnected'));
    }
  };

  // 调试Socket状态
  const handleDebugSocket = () => {
    const socket = socketService.getSocket();
    console.log('=== Socket调试信息 ===');
    console.log('连接状态:', socketService.isConnected());
    console.log('Socket实例:', socket);
    console.log('Socket ID:', socket?.id);
    console.log('当前会话:', currentSession);
    console.log('用户ID:', user?.id);
    console.log('==================');
    
    message.info(t('dashboard.debugSocketStatus') + ' output to console');
  };

  // 取消等待
  const handleCancelWaiting = () => {
    if (currentSession && currentSession.status === 'waiting') {
      const sessionId = currentSession.sessionId || currentSession.session_id;
      
      console.log('用户取消等待，会话ID:', sessionId);
      
      // 发送取消等待事件到后端
      if (socketService.isConnected() && sessionId) {
        socketService.emit('cancel_waiting', { sessionId });
        console.log('已发送cancel_waiting事件到后端');
      }
      
      // 清理本地状态
      setCurrentSession(null);
      setCustomerServiceInfo(null);
      message.success(t('chat.cancelWaiting') + ' ' + t('common.confirm'));
    } else {
      message.warning(t('dashboard.waiting') + ' session not found');
    }
  };

  // 模拟客服接受会话（测试用）
  const handleSimulateAccept = () => {
    if (currentSession && currentSession.status === 'waiting') {
      const mockData = {
        sessionId: currentSession.sessionId,
        customerServiceId: 1,
        customerServiceName: t('chat.customerService') + ' (Test)',
        message: t('dashboard.sessionAcceptedByAgent')
      };
      
      console.log('模拟客服接受会话:', mockData);
      
      // 更新会话状态
      setCurrentSession((prev: any) => ({
        ...prev,
        status: 'active',
        customerServiceId: mockData.customerServiceId
      }));
      
      // 设置客服信息
      setCustomerServiceInfo({
        id: mockData.customerServiceId,
        name: mockData.customerServiceName,
        message: mockData.message
      });
      
      message.success(t('dashboard.agentConnectedStartChat') + ' (Simulated)');
    } else {
      message.warning(t('dashboard.startChat') + ' first');
    }
  };

  // 开始对话 - 自动选择在线客服或之前联系过的客服
  const handleStartChat = async () => {
    // 确保Socket已连接
    if (!socketService.isConnected()) {
      const userToken = localStorage.getItem('userToken');
      if (userToken) {
        console.log('Socket未连接，自动连接...');
        socketService.connect(userToken);
        socketService.userLogin(userToken);
        message.info(t('dashboard.connecting'));
        // 等待连接成功后再继续
        let connected = false;
        for (let i = 0; i < 50; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (socketService.isConnected()) {
            connected = true;
            console.log('Socket连接成功');
            break;
          }
        }
        if (!connected) {
          message.error(t('dashboard.connectionTimeout'));
          return;
        }
      } else {
        message.error(t('dashboard.tokenNotFound') || 'User token not found, please login again');
        return;
      }
    }

    // 确保用户信息已加载
    if (!user?.id) {
      await loadUser();
      if (!user?.id) {
        message.error(t('dashboard.userInfoNotLoaded'));
        return;
      }
    }

    // 确保客服列表和历史会话已加载
    if (allCustomerServices.length === 0) {
      await loadAllCustomerServices();
    }
    if (historySessions.length === 0) {
      await loadHistorySessions();
    }

    // 策略1: 优先找在线客服
    const onlineCustomerService = allCustomerServices.find((cs: any) => cs.status === 'online');
    if (onlineCustomerService) {
      console.log('找到在线客服，自动连接:', onlineCustomerService);
      await handleDirectChat(onlineCustomerService);
      return;
    }

    // 策略2: 从历史会话中找到之前联系过的客服（优先找最近的active会话）
    if (historySessions.length > 0) {
      // 先找active状态的会话
      const activeSession = historySessions.find((s: any) => s.status === 'active');
      if (activeSession && activeSession.customerServiceId) {
        // 从客服列表中找到这个客服
        const previousCustomerService = allCustomerServices.find(
          (cs: any) => cs.id === activeSession.customerServiceId
        );
        if (previousCustomerService) {
          console.log('找到之前联系过的客服（活跃会话），自动连接:', previousCustomerService);
          await handleDirectChat(previousCustomerService);
          return;
        }
      }

      // 如果没有active会话，找最近的历史会话
      const recentSession = historySessions[0];
      if (recentSession && recentSession.customerServiceId) {
        const previousCustomerService = allCustomerServices.find(
          (cs: any) => cs.id === recentSession.customerServiceId
        );
        if (previousCustomerService) {
          console.log('找到之前联系过的客服（最近会话），自动连接:', previousCustomerService);
          await handleDirectChat(previousCustomerService);
          return;
        }
      }
    }

    // 策略3: 如果都没有，从所有客服中选择一个（即使离线）
    if (allCustomerServices.length > 0) {
      const anyCustomerService = allCustomerServices[0];
      console.log('没有在线客服和历史会话，选择第一个客服:', anyCustomerService);
      message.info(t('dashboard.selectCustomerService') || 'No online customer service found, connecting to available one...');
      await handleDirectChat(anyCustomerService);
      return;
    }

    // 如果都没有客服，提示用户
    message.warning(t('dashboard.noOnlineCustomerServices') || 'No customer service available at the moment');
  };

  // 消息发送已移至ChatInterface组件处理

  // 更新个人信息
  const handleUpdateProfile = async (values: any) => {
    try {
      const response = await userAPI.updateProfile(values);
      if (response.data.code === 200) {
        message.success(t('dashboard.updateSuccess'));
        setProfileModalVisible(false);
        loadUser();
      }
    } catch (error) {
      message.error(t('dashboard.updateFailed'));
    }
  };

  // 上传头像
  const handleUploadAvatar = async (file: File) => {
    try {
      // 这里需要实现头像上传逻辑
      message.success(t('dashboard.avatarUploadSuccess') || 'Avatar uploaded successfully');
      loadUser();
    } catch (error) {
      message.error(t('dashboard.avatarUploadFailed') || 'Avatar upload failed');
    }
    return false;
  };

  // 退出登录
  const handleLogout = () => {
    console.log('触发退出登录弹窗');
        modal.confirm({
      title: t('dashboard.logout'),
      content: t('dashboard.logoutConfirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      centered: true,
      maskClosable: true,
      onOk: () => {
        console.log('确认退出登录');
        socketService.disconnect();
        localStorage.removeItem('userToken');
        localStorage.removeItem('userRole');
        message.success(t('dashboard.loggedOut') || 'Logged out');
        navigate('/login');
      },
      onCancel: () => {
        console.log('取消退出登录');
      }
    });
  };

  // 用户菜单
  const userMenu = (
    <Menu>
      <Menu.Item key="profile" onClick={() => setProfileModalVisible(true)}>
        <EditOutlined /> {t('dashboard.editProfile')}
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" onClick={handleLogout}>
        <LogoutOutlined /> {t('dashboard.logout')}
      </Menu.Item>
    </Menu>
  );

  if (!user) {
    return <Loading fullscreen tip={t('common.loading')} />;
  }

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {/* 头部 */}
      <Header
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderBottom: 'none',
          padding: isMobile ? '0 12px' : '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: isMobile ? '56px' : '64px',
          flexShrink: 0,
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.15)',
          position: 'relative',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              color: '#fff',
              fontSize: isMobile ? 14 : 16,
              width: isMobile ? 28 : 32,
              height: isMobile ? 28 : 32,
              marginRight: isMobile ? 6 : 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              flexShrink: 0
            }}
          />
          {!isMobile && (
            <>
              <div style={{
                width: isMobile ? '32px' : '40px',
                height: isMobile ? '32px' : '40px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: isMobile ? '12px' : '16px',
                backdropFilter: 'blur(10px)',
                flexShrink: 0
              }}>
                <MessageOutlined style={{ fontSize: isMobile ? '18px' : '20px', color: '#fff' }} />
              </div>
              <Title level={4} style={{ margin: 0, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('dashboard.title')}</Title>
            </>
          )}
        </div>

        <Space size={isMobile ? 6 : 12} style={{ flexShrink: 0 }}>
          {/* 语言切换按钮 - PC端显示，移动端隐藏 */}
          {!isMobile && (
            <Button
              type="default"
              size="middle"
              onClick={() => {
                const currentLang = i18n.resolvedLanguage || i18n.language || 'zh';
                const isZh = currentLang.startsWith('zh');
                const newLang = isZh ? 'en' : 'zh';
                i18n.changeLanguage(newLang);
              }}
              style={{
                minWidth: 70,
                padding: '4px 0px',
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: 'none'
              }}
            >
              <span style={{
                color: (i18n.resolvedLanguage || i18n.language || 'zh').startsWith('zh') ? '#1890ff' : '#999',
                fontWeight: (i18n.resolvedLanguage || i18n.language || 'zh').startsWith('zh') ? 'bold' : 'normal',
                fontSize: 14
              }}>中</span>
              <span style={{ margin: '0 1px', color: '#d9d9d9' }}>/</span>
              <span style={{
                color: (i18n.resolvedLanguage || i18n.language || 'zh').startsWith('en') ? '#1890ff' : '#999',
                fontWeight: (i18n.resolvedLanguage || i18n.language || 'zh').startsWith('en') ? 'bold' : 'normal',
                fontSize: 14
              }}>En</span>
            </Button>
          )}
          {/* Socket连接状态 - 只显示状态，不显示连接按钮 */}
          {isMobile ? (
            <Tooltip title={isConnected ? t('dashboard.connected') : t('dashboard.connecting')}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '16px',
                background: isConnected ? 'rgba(81, 88, 77, 0.15)' : 'rgba(250, 173, 20, 0.15)',
                border: `1px solid ${isConnected ? '#52c41a' : '#faad14'}`,
                backdropFilter: 'blur(10px)'
              }}>
                <WifiOutlined style={{ color: isConnected ? '#52c41a' : '#faad14', fontSize: '16px' }} />
              </div>
            </Tooltip>
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              maxHeight: '32px',
              padding: '8px 16px',
              background: isConnected ? 'rgba(82, 196, 26, 0.15)' : 'rgba(250, 173, 20, 0.15)',
              borderRadius: '24px',
              border: `1px solid ${isConnected ? '#52c41a' : '#faad14'}`,
              backdropFilter: 'blur(10px)',
              boxShadow: `0 2px 8px ${isConnected ? 'rgba(82, 196, 26, 0.2)' : 'rgba(250, 173, 20, 0.2)'}`
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isConnected ? '#52c41a' : '#faad14',
                boxShadow: `0 0 8px ${isConnected ? '#52c41a' : '#faad14'}`
              }} />
              <WifiOutlined style={{ color: isConnected ? '#52c41a' : '#faad14', fontSize: '14px' }} />
              <span style={{ color: isConnected ? '#52c41a' : '#faad14', fontSize: '13px', fontWeight: 600 }}>
                {isConnected ? t('dashboard.connected') : t('dashboard.connecting')}
              </span>
            </div>
          )}

          {/* 当前状态 - 移动端隐藏 */}
          {!isMobile && currentSession && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              maxHeight: '32px',
              padding: '8px 16px',
              background: currentSession.status === 'active' ? 'rgba(82, 196, 26, 0.15)' : 'rgba(250, 173, 20, 0.15)',
              borderRadius: '24px',
              border: `1px solid ${currentSession.status === 'active' ? '#52c41a' : '#faad14'}`,
              backdropFilter: 'blur(10px)',
              boxShadow: `0 2px 8px ${currentSession.status === 'active' ? 'rgba(82, 196, 26, 0.2)' : 'rgba(250, 173, 20, 0.2)'}`
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: currentSession.status === 'active' ? '#52c41a' : '#faad14',
                boxShadow: `0 0 8px ${currentSession.status === 'active' ? '#52c41a' : '#faad14'}`
              }} />
              <ClockCircleOutlined style={{ color: currentSession.status === 'active' ? '#52c41a' : '#faad14', fontSize: '14px' }} />
              <span style={{ color: currentSession.status === 'active' ? '#52c41a' : '#faad14', fontSize: '13px', fontWeight: 600 }}>
                {currentSession.status === 'active' ? t('chat.chatting') : t('dashboard.waiting')}
              </span>
            </div>
          )}

          {/* 用户信息 */}
          <Dropdown overlay={userMenu} trigger={['click']}>
            {isMobile ? (
              <Button 
                type="text" 
                style={{ 
                  color: '#fff',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '20px',
                  height: '32px',
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 2px 8px rgba(255, 255, 255, 0.1)',
                  maxWidth: '120px'
                }}
              >
                <Space size={6}>
                  <Avatar
                    src={getImageUrl(user.avatar)}
                    icon={<UserOutlined />}
                    size={24}
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      flexShrink: 0
                    }}
                  />
                  <span style={{ 
                    color: '#fff', 
                    fontWeight: 600, 
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '70px'
                  }}>
                    {user.username}
                  </span>
                </Space>
              </Button>
            ) : (
              <Button 
                type="text" 
                style={{ 
                  color: '#fff',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '24px',
                  height: '40px',
                  padding: '0 20px',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 2px 8px rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Space size={8}>
                  <Avatar
                    src={getImageUrl(user.avatar)}
                    icon={<UserOutlined />}
                    size="small"
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}
                  />
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{user.username}</span>
                </Space>
              </Button>
            )}
          </Dropdown>
        </Space>
      </Header>

      <Layout style={{ height: 'calc(100vh - 64px)', overflow: 'hidden', position: 'relative' }}>
        {/* 移动端遮罩层 */}
        {isMobile && !sidebarCollapsed && (
          <div
            style={{
              position: 'fixed', top: isMobile ? 56 : 64, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.45)', zIndex: 998
            }}
            onClick={() => setSidebarCollapsed(true)}
          />
        )}
        {/* 侧边栏 */}
        <Sider
          collapsible
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
          width={320}
          collapsedWidth={0}
          breakpoint="md"
          style={{ 
            background: '#fff', 
            borderRight: '1px solid #f0f0f0', 
            height: '100%', 
            overflow: 'hidden',
            boxShadow: '2px 0 8px rgba(0, 0, 0, 0.06)',
            position: isMobile && !sidebarCollapsed ? 'fixed' : 'relative',
            zIndex: isMobile && !sidebarCollapsed ? 999 : 1,
            left: isMobile && sidebarCollapsed ? -320 : 0,
            transition: 'all 0.2s'
          }}
          trigger={null}
        >
          <div style={{ 
            padding: '20px', 
            height: '100%', 
            overflow: 'auto',
            background: 'linear-gradient(180deg, #fafbfc 0%, #f8f9fa 100%)'
          }}>
            <Card 
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: currentSession?.status === 'active' ? '#52c41a' : currentSession ? '#faad14' : '#d9d9d9'
                  }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{t('dashboard.customerServiceStatus')}</span>
                </div>
              } 
              size="small" 
              style={{ 
                marginBottom: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                border: '1px solid #f0f0f0'
              }}
              headStyle={{
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderRadius: '12px 12px 0 0',
                borderBottom: '1px solid #e9ecef'
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>{t('dashboard.currentStatus')}{currentSession ? (currentSession.status === 'active' ? t('chat.chatting') : t('dashboard.waiting')) : t('dashboard.notStarted')}</Text>
                {currentSession && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {t('dashboard.sessionId')}: {currentSession.sessionId || currentSession.session_id}
                  </Text>
                )}
                {customerServiceInfo && (
                  <div style={{ padding: '8px', background: '#f0f0f0', borderRadius: '4px' }}>
                    <Text strong>{t('dashboard.servingAgent')}</Text>
                    <br />
                    <Text>{customerServiceInfo.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {customerServiceInfo.message}
                    </Text>
                  </div>
                )}
                {/* 开始对话按钮 */}
                {!currentSession && (
                  <Button 
                    type="primary" 
                    onClick={handleStartChat}
                    style={{ 
                      width: '100%', 
                      marginBottom: '12px',
                      height: '40px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(82, 196, 26, 0.3)',
                      fontWeight: 600
                    }}
                  >
                    {t('dashboard.startChat')}
                  </Button>
                )}
                
                {/* 等待状态按钮 */}
                {currentSession && currentSession.status === 'waiting' && (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Button 
                      type="primary" 
                      onClick={handleStartChat}
                      style={{ 
                        width: '100%',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #faad14 0%, #d48806 100%)',
                        border: 'none',
                        boxShadow: '0 3px 8px rgba(250, 173, 20, 0.3)',
                        fontWeight: 600
                      }}
                    >
                      {t('dashboard.reconnect')}
                    </Button>
                    <Button 
                      type="default" 
                      onClick={() => {
                        setCurrentSession(null);
                        setCustomerServiceInfo(null);
                      }}
                      style={{ 
                        width: '100%',
                        height: '36px',
                        borderRadius: '8px',
                        border: '1px solid #d9d9d9',
                        background: '#fff',
                        color: '#666',
                        fontWeight: 500
                      }}
                    >
                      {t('chat.cancelWaiting')}
                    </Button>
                  </Space>
                )}
                
                {/* 对话中状态 */}
                {currentSession && currentSession.status === 'active' && (
                  <Button 
                    type="primary" 
                    disabled
                    style={{ 
                      width: '100%',
                      height: '40px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                      border: 'none',
                      fontWeight: 600
                    }}
                  >
                    {t('chat.chatting')}...
                  </Button>
                )}
              </Space>
            </Card>

            {/* 历史会话 */}
            {historySessions.length > 0 && (
              <Card 
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#1890ff'
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{t('dashboard.historySessions')}</span>
                  </div>
                } 
                size="small" 
                style={{ 
                  marginBottom: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  border: '1px solid #f0f0f0'
                }}
                headStyle={{
                  background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                  borderRadius: '12px 12px 0 0',
                  borderBottom: '1px solid #e9ecef'
                }}
              >
                <List
                  dataSource={historySessions}
                  renderItem={(session: any) => (
                    <List.Item
                      actions={[
                        <Button
                          key="view"
                          type="link"
                          size="small"
                          onClick={() => handleViewHistorySession(session)}
                        >
                          {t('common.view')}
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar style={{ backgroundColor: session.status === 'active' ? '#52c41a' : '#8c8c8c' }}>{t('chat.customerService')}{session.customerServiceId || t('dashboard.unknown')}</Avatar>}
                        title={
                          <Space direction="horizontal" size={8}>
                            <Text strong>{t('chat.customerService')}{session.customerServiceId || t('dashboard.unknown')}</Text>
                            <Tag color={session.status === 'active' ? 'green' : 'default'}>
                              {session.status === 'active' ? t('dashboard.inProgress') : t('dashboard.ended')}
                            </Tag>
                          </Space>
                        }
                        description={
                          <div style={{ fontSize: 12, color: '#666' }}>
                            <div style={{ marginBottom: 4 }}>
                              <Text type="secondary">{t('dashboard.sessionId')}: </Text>
                              <Text code style={{ fontSize: 11 }}>{session.sessionId || session.session_id}</Text>
                            </div>
                            <div>
                              <Text type="secondary">
                                {session.status === 'active' ? t('dashboard.startTime') + ': ' : t('dashboard.endTime')}
                              </Text>
                              <Text type="secondary">
                                {session.status === 'active' 
                                  ? (session.startedAt ? new Date(session.startedAt).toLocaleString() : t('dashboard.unknown'))
                                  : (session.endedAt ? new Date(session.endedAt).toLocaleString() : t('dashboard.unknown'))
                                }
                              </Text>
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {/* 所有客服列表 */}
            {allCustomerServices.length > 0 && (
              <Card 
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#722ed1'
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{t('dashboard.customerServiceList')}</span>
                  </div>
                } 
                size="small" 
                style={{ 
                  marginBottom: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  border: '1px solid #f0f0f0'
                }}
                headStyle={{
                  background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                  borderRadius: '12px 12px 0 0',
                  borderBottom: '1px solid #e9ecef'
                }}
              >
                <List
                  dataSource={allCustomerServices}
                  renderItem={(cs: any) => (
                    <List.Item
                      actions={[
                        <Button
                          key="chat"
                          type="primary"
                          size="small"
                          onClick={() => handleDirectChat(cs)}
                        >
                          {t('dashboard.chatButton')}
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ 
                            backgroundColor: cs.status === 'online' ? '#52c41a' : '#8c8c8c' 
                          }}>
                            {cs.username.charAt(0)}
                          </Avatar>
                        }
                        title={
                          <Space direction="horizontal" size={8}>
                            <Text strong>{cs.username}</Text>
                            <Tag color={cs.status === 'online' ? 'green' : 'default'}>
                              {cs.status === 'online' ? t('dashboard.online') : t('dashboard.offline')}
                            </Tag>
                          </Space>
                        }
                        description={
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            <div>{t('dashboard.currentChats')}: {cs.current_chats}/{cs.max_concurrent_chats}</div>
                            <div>ID: {cs.id}</div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}

            <Card 
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#13c2c2'
                  }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{t('dashboard.helpInfo')}</span>
                </div>
              } 
              size="small"
              style={{ 
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                border: '1px solid #f0f0f0'
              }}
              headStyle={{
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderRadius: '12px 12px 0 0',
                borderBottom: '1px solid #e9ecef'
              }}
            >
              <div style={{
                padding: '12px',
                background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
                borderRadius: '8px',
                border: '1px solid #91d5ff'
              }}>
                <Text type="secondary" style={{ fontSize: '13px', lineHeight: '1.5' }}>
                  {t('dashboard.helpMessage')}
                </Text>
              </div>
            </Card>
          </div>
        </Sider>

        {/* 主内容区 */}
        <Content style={{ 
          padding: '20px', 
          height: '100%', 
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
        }}>
          {currentSession ? (
            <ChatInterface
              currentSession={currentSession}
              onSessionChange={setCurrentSession}
              userType="user"
            />
          ) : currentSession && currentSession.status === 'waiting' ? (
            <Card style={{ 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              border: 'none'
            }}>
              <div style={{ 
                textAlign: 'center',
                padding: '40px',
                background: '#fff',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                maxWidth: '500px',
                width: '100%'
              }}>
                <ClockCircleOutlined style={{ fontSize: '64px', color: '#fa8c16', marginBottom: '16px' }} />
                  <Title level={3} style={{ color: '#fa8c16', marginBottom: '8px' }}>
                  {t('dashboard.waitingForAgentTitle')}
                </Title>
                <Title level={5} type="secondary" style={{ margin: '0 0 24px 0' }}>
                  {t('dashboard.waitingForAgentDescription')}
                </Title>
                
                {/* 会话信息 */}
                <div style={{ marginBottom: '24px', padding: '16px', background: '#fff7e6', borderRadius: '8px', border: '1px solid #ffd591' }}>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                    {t('dashboard.sessionId')}: {currentSession.sessionId || currentSession.session_id}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                    {t('dashboard.waitingTime')}: {Math.floor((Date.now() - new Date(currentSession.createdAt || Date.now()).getTime()) / 60000)} {t('dashboard.minutes')}
                  </Text>
                </div>
                
                {/* 操作按钮 */}
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button 
                    type="primary" 
                    size="large"
                    onClick={handleStartChat}
                    style={{ width: '100%', height: '40px' }}
                  >
                    {t('dashboard.resendConnectionRequest')}
                  </Button>
                  <Button 
                    type="default" 
                    size="large"
                    onClick={handleTestConnection}
                    style={{ width: '100%', height: '40px' }}
                  >
                    {t('dashboard.testConnection')}
                  </Button>
                  <Button 
                    type="default" 
                    size="large"
                    onClick={handleDebugSocket}
                    style={{ width: '100%', height: '40px' }}
                  >
                    {t('dashboard.debugSocketStatus')}
                  </Button>
                  <Button 
                    type="primary" 
                    size="large"
                    onClick={handleSimulateAccept}
                    style={{ 
                      width: '100%', 
                      height: '40px',
                      background: '#52c41a',
                      borderColor: '#52c41a'
                    }}
                  >
                    {t('dashboard.simulateAccept')}
                  </Button>
                  <Button 
                    type="default" 
                    size="large"
                    onClick={handleCancelWaiting}
                    style={{ width: '100%', height: '40px' }}
                  >
                    取消等待
                  </Button>
                </Space>
                
                {/* 连接状态提示 */}
                <div style={{ marginTop: '16px', padding: '8px', background: isConnected ? '#f6ffed' : '#fff2f0', borderRadius: '4px', border: `1px solid ${isConnected ? '#b7eb8f' : '#ffccc7'}` }}>
                  <Text style={{ fontSize: '12px', color: isConnected ? '#52c41a' : '#ff4d4f' }}>
                    {t('dashboard.socketStatus')}: {isConnected ? t('dashboard.connected') : t('dashboard.notConnected')}
                  </Text>
                </div>
              </div>
            </Card>
          ) : (
            <Card style={{ 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
            }}>
              <div style={{ 
                textAlign: 'center',
                padding: '60px 40px',
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                maxWidth: '500px',
                width: '100%',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                  boxShadow: '0 8px 24px rgba(24, 144, 255, 0.3)'
                }}>
                  <MessageOutlined style={{ fontSize: '36px', color: '#fff' }} />
                </div>
                <Title level={3} style={{ color: '#1890ff', marginBottom: '12px', fontWeight: 600 }}>
                  {t('dashboard.startChat')}
                </Title>
                <Title level={5} type="secondary" style={{ margin: 0, lineHeight: '1.6' }}>
                  {t('dashboard.startChatDescription')}
                </Title>
              </div>
            </Card>
          )}
        </Content>
      </Layout>

      {/* 编辑资料模态框 */}
      <Modal
        title={t('dashboard.editProfile')}
        open={profileModalVisible}
        onCancel={() => setProfileModalVisible(false)}
        onOk={() => profileForm.submit()}
      >
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleUpdateProfile}
        >
          <Form.Item label={t('dashboard.avatar')}>
            <Upload
              beforeUpload={handleUploadAvatar}
              showUploadList={false}
              accept="image/*"
            >
              <Avatar
                size={80}
                src={getImageUrl(user.avatar)}
                icon={<UserOutlined />}
                style={{ cursor: 'pointer' }}
              />
            </Upload>
            <div style={{ marginTop: '8px' }}>
              <Button icon={<CameraOutlined />} size="small">
                {t('dashboard.changeAvatar')}
              </Button>
            </div>
          </Form.Item>

          <Form.Item
            name="realName"
            label={t('dashboard.realName')}
          >
            <Input placeholder={t('dashboard.realName')} />
          </Form.Item>
        </Form>
      </Modal>
      {contextHolder}
    
    </Layout>
  );
};

export default UserDashboard;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layout,
  Card,
  Tag,
  Row,
  Col,
  Statistic,
  Avatar,
  Typography,
  Button,
  Space,
  Badge,
  Dropdown,
  Menu,
  message,
  Modal,
  Form,
  Input,
  Upload,
  List,
  Pagination,
  Switch
} from 'antd';
import {
  UserOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  LogoutOutlined,
  CameraOutlined,
  EditOutlined,
  WifiOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CustomerService, ChatStatistics } from '../types';
import { customerServiceAPI, chatAPI } from '../services/api';
import socketService from '../services/socket';
import ChatInterface from './ChatInterface';
import dayjs from 'dayjs';
import { getImageUrl, getFileUrl } from '../utils/url';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [customerService, setCustomerService] = useState<CustomerService | null>(null);
  const [statistics, setStatistics] = useState<ChatStatistics | null>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileForm] = Form.useForm();
  const [isConnected, setIsConnected] = useState(false);
  const [modal, contextHolder] = Modal.useModal();
  const [waitingUsers, setWaitingUsers] = useState<any[]>([]);
  const [mySessions, setMySessions] = useState<any[]>([]);
  // 未读消息数量（key: sessionId, value: count）
  const [unreadMessageCounts, setUnreadMessageCounts] = useState<Record<string, number>>({});
  // 在线客服（仅客服角色）
  const [onlineCustomerServices, setOnlineCustomerServices] = useState<any[]>([]);
  // 今日消息查看相关状态
  const [todayModalVisible, setTodayModalVisible] = useState(false);
  const [todayUsers, setTodayUsers] = useState<any[]>([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [selectedTodayUser, setSelectedTodayUser] = useState<any>(null);
  const [todayUserMessages, setTodayUserMessages] = useState<any[]>([]);
  // 分页相关状态
  const [todayMessagePage, setTodayMessagePage] = useState(1);
  const [todayMessagePageSize] = useState(20);
  const [todayMessageTotal, setTodayMessageTotal] = useState(0);
  const [todayOnlyToday, setTodayOnlyToday] = useState(false); // 是否只看今天的消息，默认关闭
  // 侧边栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // 是否为移动端
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // 监听窗口大小变化，自动折叠侧边栏
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // 当屏幕宽度小于768px时自动折叠
      if (mobile) {
        setSidebarCollapsed(true);
      } else {
        // 桌面端默认展开
        setSidebarCollapsed(false);
      }
    };

    // 初始检查
    checkScreenSize();

    // 监听窗口大小变化
    window.addEventListener('resize', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  // 拉取等待中的会话（用于页面刷新或客服刚登录后兜底）
  const loadWaitingSessions = useCallback(async () => {
    try {
      const res = await (customerServiceAPI as any).getWaitingSessions?.();
      const list = res?.data?.data?.list || [];
      // 统一结构，便于与 socket 事件合并
      const mapped = list.map((item: any) => ({
        sessionId: item.session_id || item.sessionId,
        userId: item.user_id || item.userId,
        username: item.username || `用户${item.user_id || item.userId}`,
        email: item.email,
        avatar: item.avatar,
        priority: item.priority || 'normal',
        status: item.status || 'waiting',
        timestamp: item.created_at || item.createdAt || new Date().toISOString(),
        customerServiceId: item.customer_service_id || item.customerServiceId,
      })).filter((x: any) => x.sessionId && x.userId && x.status === 'waiting'); // 只显示等待状态的会话

      // 仅显示当前客服负责的等待会话
      const onlyMine = mapped.filter((x: any) => !customerService?.id || x.customerServiceId === customerService?.id);

      setWaitingUsers((prev: any[]) => {
        // 合并 API 返回的数据和 Socket 推送的数据，避免覆盖
        // 创建一个以 sessionId 为 key 的 Map 来去重
        const sessionMap = new Map<string, any>();
        
        // 先添加 Socket 推送的数据（prev），这些是实时推送的
        prev.forEach((session: any) => {
          if (session.sessionId && session.status === 'waiting') {
            sessionMap.set(session.sessionId, session);
          }
        });
        
        // 再添加 API 返回的数据，更新或补充
        onlyMine.forEach((session: any) => {
          if (session.sessionId) {
            const existing = sessionMap.get(session.sessionId);
            // 如果已存在，保留时间戳更晚的
            if (!existing || new Date(session.timestamp || 0) > new Date(existing.timestamp || 0)) {
              sessionMap.set(session.sessionId, session);
            }
          }
        });
        
        // 转换为数组
        const allSessions = Array.from(sessionMap.values());
        console.log('📥 [前端] loadWaitingSessions 收到API数据:', onlyMine.length, '个会话');
        console.log('📥 [前端] loadWaitingSessions 合并后总数:', allSessions.length, '个会话', allSessions.map((s:any) => ({ sessionId: s.sessionId, userId: s.userId })));
        
        // 按用户ID分组，只保留每个用户最新的等待会话
        const byUserId = new Map<number, any>();
        allSessions.forEach((session: any) => {
          const userId = session.userId;
          const existing = byUserId.get(userId);
          if (!existing || new Date(session.timestamp || 0) > new Date(existing.timestamp || 0)) {
            byUserId.set(userId, session);
          }
        });
        
        // 转换为数组并按时间排序
        const filteredSessions = Array.from(byUserId.values());
        const sorted = filteredSessions.sort((a: any, b: any) => 
          new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
        );
        console.log('📥 [前端] loadWaitingSessions 处理后的等待列表:', sorted.length, '个会话', sorted.map((s:any) => ({ sessionId: s.sessionId, userId: s.userId })));
        return sorted;
      });
    } catch (e) {
      // 忽略错误，保持页面可用
      console.warn('加载等待会话失败:', e);
    }
  }, [customerService?.id]);

  // 恢复活跃会话（刷新页面后自动恢复）
  const restoreActiveSession = useCallback(async () => {
    // 如果已经有当前会话，不需要恢复
    if (currentSession) {
      return;
    }

    try {
      const res = await chatAPI.getSessions();
      const list = res?.data?.data?.list || [];
      // 查找活跃状态的会话
      const activeSession = list.find((item: any) => item.status === 'active');
      
      if (activeSession) {
        const sessionId = (activeSession as any).session_id || (activeSession as any).sessionId;
        const userId = (activeSession as any).user_id || (activeSession as any).userId;
        
        console.log('发现活跃会话，正在恢复:', sessionId);
        
        // 设置当前会话
        setCurrentSession({
          sessionId: sessionId,
          session_id: sessionId,
          userId: userId,
          user_id: userId,
          username: (activeSession as any).username || `用户${userId}`,
          status: 'active',
        });
        
        // 加入会话房间
        if (socketService.isConnected() && sessionId) {
          socketService.joinRoom(`session_${sessionId}`);
          console.log('已加入会话房间:', sessionId);
        }
      }
    } catch (e) {
      console.warn('恢复活跃会话失败:', e);
    }
  }, [currentSession]);

  // 拉取我的会话（已接受的会话）
  const loadMySessions = useCallback(async () => {
    try {
      const res = await chatAPI.getSessions();
      const list = res?.data?.data?.list || [];
      // 只显示活跃和已结束的会话
      const mapped = list.map((item: any) => ({
        sessionId: item.session_id || item.sessionId,
        userId: item.user_id || item.userId,
        username: item.username || `用户${item.user_id || item.userId}`,
        status: item.status || 'active',
        priority: item.priority || 'normal',
        timestamp: item.created_at || item.createdAt || new Date().toISOString(),
        startedAt: item.started_at || item.startedAt,
        endedAt: item.ended_at || item.endedAt,
      })).filter((x: any) => x.sessionId && x.userId);

      setMySessions(mapped.sort((a: any, b: any) => 
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      ));
      
      // 加载会话列表后，尝试恢复活跃会话
      if (!currentSession) {
        const activeSession = list.find((item: any) => item.status === 'active');
        if (activeSession) {
          const sessionId = (activeSession as any).session_id || (activeSession as any).sessionId;
          const userId = (activeSession as any).user_id || (activeSession as any).userId;
          
          console.log('发现活跃会话，正在恢复:', sessionId);
          
          setCurrentSession({
            sessionId: sessionId,
            session_id: sessionId,
            userId: userId,
            user_id: userId,
            username: (activeSession as any).username || `用户${userId}`,
            status: 'active',
          });
          
          // 如果Socket已连接，加入会话房间
          if (socketService.isConnected() && sessionId) {
            socketService.joinRoom(`session_${sessionId}`);
            console.log('已加入会话房间:', sessionId);
          }
        }
      }
    } catch (e) {
      console.warn('加载我的会话失败:', e);
    }
  }, [currentSession]);

  // 加载客服信息
  const loadCustomerService = useCallback(async () => {
    try {
      const response = await customerServiceAPI.getProfile();
      if (response.data.code === 200) {
        setCustomerService(response.data.data || null);
        profileForm.setFieldsValue({
          maxConcurrentChats: response.data.data?.max_concurrent_chats
        });
        return response.data.data;
      }
    } catch (error) {
      message.error(t('dashboard.loadFailed'));
      throw error;
    }
  }, [profileForm, t]);

  // 加载统计数据
  const loadStatistics = useCallback(async () => {
    try {
      const response = await chatAPI.getStatistics();
      if (response.data.code === 200) {
        setStatistics(response.data.data || null);
      } else {
        console.error('加载统计数据失败:', response.data.message);
      }
    } catch (error: any) {
      console.error('加载统计数据失败:', error);
      // 不显示错误提示，避免影响用户体验，只在控制台记录
    }
  }, []);

  // 加载在线客服列表（仅客服角色）
  const loadOnlineCustomerServices = useCallback(async () => {
    try {
      const res = await (customerServiceAPI as any).getOnlineList?.();
      // 后端返回形如 { code, message, data: { list: [], total } }
      const list = res?.data?.data?.list || [];
      setOnlineCustomerServices(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('加载在线客服列表失败', e);
    }
  }, []);

  // 加载今日有消息往来的用户列表
  const loadTodayUsers = useCallback(async () => {
    setTodayLoading(true);
    try {
      const res = await chatAPI.getSessions();
      const sessions = res?.data?.data?.list || [];
      const normalized = sessions.map((item: any) => ({
        sessionId: item.session_id || item.sessionId,
        userId: item.user_id || item.userId,
        username: item.username || `用户${item.user_id || item.userId}`,
        createdAt: item.created_at || item.createdAt,
        updatedAt: item.updated_at || item.updatedAt,
        status: item.status || 'active'
      })).filter((s: any) => s.sessionId && s.userId);

      const result: any[] = [];
      // 逐个会话检查是否有今日消息（取前100条足够覆盖今天）
      for (const s of normalized) {
        try {
          const resp = await chatAPI.getSessionMessages(s.sessionId, 1, 100);
          const list = resp?.data?.data?.list || [];
          const todays = list.filter((m: any) => dayjs((m as any).created_at || (m as any).createdAt).isSame(dayjs(), 'day'));
          if (todays.length > 0) {
            const last = todays[todays.length - 1] as any;
            result.push({
              sessionId: s.sessionId,
              userId: s.userId,
              username: s.username,
              lastTime: (last as any).created_at || (last as any).createdAt,
            });
          }
        } catch (e) {
          // 忽略单个会话错误
        }
      }
      // 按最后时间倒序
      result.sort((a, b) => new Date(b.lastTime || 0).getTime() - new Date(a.lastTime || 0).getTime());
      setTodayUsers(result);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  // 加载某个用户的消息（实时请求，服务端过滤与分页）
  const loadTodayMessagesForUser = useCallback(async (sessionId: string, page: number = 1, append: boolean = false, onlyTodayOverride?: boolean) => {
    setTodayLoading(true);
    try {
      const effectiveOnlyToday = typeof onlyTodayOverride === 'boolean' ? onlyTodayOverride : todayOnlyToday;
      const resp = await chatAPI.getSessionMessages(sessionId, page, todayMessagePageSize, effectiveOnlyToday);
      const list = (resp as any)?.data?.data?.list || [];
      const total = (resp as any)?.data?.data?.total ?? list.length;

      if (append) {
        setTodayUserMessages(prev => [...prev, ...list]);
      } else {
        setTodayUserMessages(list as any);
      }

      setTodayMessagePage(page);
      setTodayMessageTotal(total);
    } catch (error) {
      message.error('加载消息失败');
      console.error('加载消息失败:', error);
    } finally {
      setTodayLoading(false);
    }
  }, [todayMessagePageSize, todayOnlyToday]);

  // （原始版本无：在线客服列表加载）

  // 使用ref保存当前会话，避免useEffect依赖导致重复绑定
  const currentSessionRef = useRef<any>(null);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);
  
  // 使用ref保存会话列表，避免闭包问题
  const mySessionsRef = useRef<any[]>([]);
  useEffect(() => {
    mySessionsRef.current = mySessions;
  }, [mySessions]);

  useEffect(() => {
    loadStatistics();
    // 页面加载时拉取等待会话数据
    loadWaitingSessions();
    // 页面加载时拉取我的会话数据
    loadMySessions();
    // 原始版本不加载在线客服列表
    
    // 加载客服信息，加载完成后会自动连接Socket
    loadCustomerService().then(() => {
      // 客服信息加载完成后，检查并连接Socket
      const customerServiceToken = localStorage.getItem('customerServiceToken');
      if (customerServiceToken) {
        const socket = socketService.getSocket();
        const isConnected = socketService.isConnected();
        
        console.log('客服信息加载完成，检查Socket状态:', {
          hasSocket: !!socket,
          isConnected,
          socketId: socket?.id
      });
      
        // 如果Socket不存在或未连接，则尝试连接
        if (!socket || !isConnected) {
          console.log('Socket未连接，初始化连接...');
          // 页面加载时的初始化连接，传入 isInitial=true 跳过冷却限制
          socketService.connect(customerServiceToken, true);
        } else {
          console.log('Socket已连接，更新状态');
          setIsConnected(true);
          // 如果Socket已连接但客服还未登录，发送登录请求
          if (customerService?.id) {
            console.log('Socket已连接，发送客服登录请求');
            socketService.setUserInfo('customer_service', customerService.id);
          setTimeout(() => {
            socketService.customerServiceLogin(customerServiceToken);
            }, 200);
        }
      }
      } else {
        console.warn('未找到客服Token，无法连接Socket');
      }
    });
    
    // 定期刷新统计数据（每30秒刷新一次）
    const statisticsInterval = setInterval(() => {
      loadStatistics();
    }, 30000);
    
    return () => {
      clearInterval(statisticsInterval);
    };
  }, [loadStatistics, loadWaitingSessions, loadMySessions, loadCustomerService]);

  // 当客服信息加载完成后，设置Socket用户信息
  useEffect(() => {
    if (customerService?.id && socketService.isConnected()) {
      console.log('设置Socket用户信息:', customerService.id);
      socketService.setUserInfo('customer_service', customerService.id);
    }
  }, [customerService?.id]);

  // 监听Socket.IO事件
  useEffect(() => {
    // 使用ref保存事件处理函数，确保可以正确清理
    const handleConnect = () => {
      console.log('✅ Socket连接成功');
      // 使用函数式更新，避免依赖外部状态
      setIsConnected(prev => {
        if (!prev) {
          console.log('✅ 连接状态更新: 未连接 -> 已连接');
        }
        return true;
      });
      
      // Socket连接成功后，自动发送客服登录请求（确保userType被设置）
      const customerServiceToken = localStorage.getItem('customerServiceToken');
      if (customerServiceToken && customerService?.id) {
        console.log('Socket连接成功，自动发送客服登录请求');
        // 先设置前端用户信息
        socketService.setUserInfo('customer_service', customerService.id);
        // 发送登录请求到后端（后端会设置socket.userType）
        setTimeout(() => {
          socketService.customerServiceLogin(customerServiceToken);
        }, 300); // 短暂延迟，确保Socket完全准备好
      }
      
      // 使用ref来跟踪是否是初次连接，避免重连时频繁提示
      // 只在真正需要时显示提示（用户手动连接或首次连接）
      
      // Socket重连后，重新加载在线客服列表以确保状态同步
      loadOnlineCustomerServices();
      
      // 注意：不要在这里立即加入房间，等待客服登录成功（login_success事件）后再加入
    };

    const handleDisconnect = (reason: string) => {
      console.warn('⚠️ Socket连接断开，原因:', reason);
      // 使用函数式更新，避免频繁切换
      setIsConnected(prev => {
        if (prev) {
          console.warn('⚠️ 连接状态更新: 已连接 -> 未连接');
        }
        return false;
      });
      
      // Socket.IO有自动重连机制，不需要手动重连（避免冲突）
      // 只在明确是客户端主动断开或需要时，才手动重连
      if (reason === 'io client disconnect' || reason === 'io server disconnect') {
        // 服务器或客户端主动断开，不自动重连
        console.log('主动断开连接，不自动重连');
      } else {
        // 网络问题导致的断开，Socket.IO会自动重连，这里只显示提示
        // 不显示警告消息，避免频繁提示打扰用户（Socket.IO会自动重连）
        // message.warning(t('dashboard.connectionDisconnected') || 'Connection disconnected');
        console.log('网络断开，等待Socket.IO自动重连...');
      }
    };

    const handleLoginSuccess = (data: any) => {
      console.log('✅ 客服登录成功:', data);
      // 不在login_success中设置连接状态，因为connect事件已经设置了
      // setIsConnected已在connect事件中设置为true，这里不需要重复设置
      if (data.customerService) {
        // 确保客服状态为online
        const csData = {
          ...data.customerService,
          status: 'online' as const
        };
        setCustomerService(csData);
        // 设置Socket用户信息
        if (csData.id) {
          socketService.setUserInfo('customer_service', csData.id);
        }
      } else {
        // 如果没有客服信息，使用已加载的客服信息或创建默认状态
        setCustomerService(prev => {
          if (prev) {
            const updated = { ...prev, status: 'online' as const };
            // 设置Socket用户信息
            if (updated.id) {
              socketService.setUserInfo('customer_service', updated.id);
            }
            return updated;
          }
          return { 
          id: 0, 
          username: '客服', 
            status: 'online' as const
          } as any;
        });
      }
      message.success(t('dashboard.loginSuccess'));
      // 登录后拉一次等待会话，避免遗漏（延迟调用，给 Socket 推送留出时间）
      // 注意：后端已经在 customer_service_login 时通过 Socket 推送了等待会话
      // 这里延迟调用作为兜底，确保数据同步
      setTimeout(() => {
      loadWaitingSessions();
      }, 2000);
      // 登录后拉一次我的会话
      loadMySessions();
      // 登录后刷新统计数据
      loadStatistics();
      // 原始版本无：登录后拉取在线客服列表
      
      // 登录成功后，尝试恢复活跃会话
      setTimeout(() => {
        if (currentSessionRef.current?.sessionId) {
          // 如果已有会话，重新加入房间
          socketService.joinRoom(`session_${currentSessionRef.current.sessionId}`);
          console.log('登录后重新加入会话房间:', currentSessionRef.current.sessionId);
        } else {
          // 如果没有会话，尝试恢复活跃会话
          restoreActiveSession();
        }
      }, 1000);
    };

    const handleLoginError = (data: any) => {
      console.error('客服登录失败:', data);
      setIsConnected(false);
      message.error(t('dashboard.loginFailed') || 'Login failed');
    };

    const handleStatusUpdated = (data: any) => {
      console.log('状态更新成功:', data);
      if (data.status) {
        setCustomerService((prev:any) => prev ? { ...prev, status: data.status } : null);
      }
    };

    // 注册所有事件监听器（统一管理，便于清理）
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('login_success', handleLoginSuccess);
    socketService.on('login_error', handleLoginError);
    socketService.on('status_updated', handleStatusUpdated);

    const handleError = (data: any) => {
      console.error('❌ [前端] ========== Socket错误 ==========');
      console.error('❌ [前端] 错误数据:', JSON.stringify(data, null, 2));
      console.error('❌ [前端] 当前会话状态:', currentSession);
      
      message.error(data.message || t('dashboard.operationFailed') || 'Operation failed');
      
      // 如果是接受会话失败，且错误中有sessionId，尝试恢复
      // 注意：不再检查会话ID是否匹配，因为可能是不同会话的错误
      if (data.sessionId) {
        console.warn('⚠️ [前端] 检测到会话相关的错误，sessionId:', data.sessionId);
        console.warn('⚠️ [前端] 当前会话ID:', currentSession?.session_id || currentSession?.sessionId);
        
        // 如果错误中的sessionId在当前等待列表中，说明这个会话确实存在
        const errorSessionInWaiting = waitingUsers.find((u:any) => u.sessionId === data.sessionId);
        if (errorSessionInWaiting) {
          console.warn('⚠️ [前端] 错误会话在等待列表中，可能是接受失败');
          // 不恢复状态，因为可能是其他会话的错误
          // 只是记录日志，让用户知道有问题
        }
        
        // 如果错误中的sessionId正好是当前会话，才恢复状态
        if (currentSession && (currentSession.session_id === data.sessionId || currentSession.sessionId === data.sessionId)) {
          console.warn('⚠️ [前端] 错误会话ID匹配当前会话，恢复等待状态');
          setCurrentSession({
            ...currentSession,
            status: 'waiting'
          });
          // 重新加载等待列表
          loadWaitingSessions();
        } else {
          console.warn('⚠️ [前端] 错误会话ID不匹配当前会话，可能是其他会话的错误，不恢复状态');
        }
      }
    };

    socketService.on('error', handleError);

    // 监听新消息事件
    const handleNewMessage = (data: any) => {
      console.log('📬 [前端] Dashboard收到新消息事件:', data);
      
      // 如果是用户发送的消息
      if (data.senderType === 'user' && data.sessionId) {
        const messageSessionId = data.sessionId;
        const currentSessionId = currentSession?.session_id || currentSession?.sessionId;
        
          // 统一sessionId格式（确保字符串比较，避免类型不一致问题）
          const normalizedMessageSessionId = String(messageSessionId || '').trim();
          const normalizedCurrentSessionId = currentSessionId ? String(currentSessionId).trim() : '';
          
          console.log('📬 [前端] 消息会话信息:', {
            messageSessionId,
            normalizedMessageSessionId,
            currentSessionId,
            normalizedCurrentSessionId,
            isCurrentSession: normalizedMessageSessionId === normalizedCurrentSessionId && normalizedCurrentSessionId !== ''
          });
        
        // 如果是当前会话的消息，确保客服在房间中，并清零未读计数
        if (normalizedMessageSessionId === normalizedCurrentSessionId && normalizedCurrentSessionId !== '') {
          socketService.joinRoom(`session_${normalizedMessageSessionId}`);
          console.log('✅ [前端] 当前会话的新消息，确保客服在房间中');
          // 清零当前会话的未读计数
          setUnreadMessageCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts[normalizedMessageSessionId];
            return newCounts;
          });
          return;
        }
        
        // 如果是其他会话的消息，增加未读消息计数
        console.log('📬 [前端] 收到其他会话的新消息，检查会话是否在列表中:', normalizedMessageSessionId);
        
        // 检查该会话是否在 mySessions 列表中（使用ref获取最新值）
        const currentSessions = mySessionsRef.current || [];
        
        console.log('📬 [前端] 检查会话是否在列表中:', {
          messageSessionId: normalizedMessageSessionId,
          currentSessionsCount: currentSessions.length,
          sessionIds: currentSessions.map((s: any) => ({
            sessionId: s.sessionId,
            session_id: s.session_id,
            normalizedId: String(s.sessionId || s.session_id || '').trim()
          }))
        });
        
        const sessionInList = currentSessions.some((s: any) => {
          const sId = s.sessionId || s.session_id;
          // 统一格式进行比较（字符串）
          const normalizedSessionId = String(sId || '').trim();
          const match = normalizedSessionId === normalizedMessageSessionId;
          if (match) {
            console.log('✅ [前端] 找到匹配的会话:', {
              messageSessionId: normalizedMessageSessionId,
              sessionId: s.sessionId,
              session_id: s.session_id,
              username: s.username
            });
          }
          return match;
        });
        
        if (sessionInList) {
          // 会话在列表中，增加未读计数
          setUnreadMessageCounts(prev => {
            const newCount = (prev[normalizedMessageSessionId] || 0) + 1;
            console.log('✅ [前端] 会话在列表中，更新未读消息计数:', {
              messageSessionId: normalizedMessageSessionId,
              oldCount: prev[normalizedMessageSessionId] || 0,
              newCount
            });
            return {
              ...prev,
              [normalizedMessageSessionId]: newCount
            };
          });
        } else {
          console.warn('⚠️ [前端] 会话不在列表中，尝试从后端加载:', {
            messageSessionId: normalizedMessageSessionId,
            currentSessionsCount: currentSessions.length,
            sessionIds: currentSessions.map((s: any) => String(s.sessionId || s.session_id || '').trim())
          });
          
          // 即使会话不在列表中，也从后端确认一下，如果在后端存在且状态是active，则添加到列表并增加未读计数
        chatAPI.getSessions().then((resp: any) => {
          if (resp?.data?.code === 200) {
            const sessions = resp.data.data?.list || resp.data.data || [];
              const session = sessions.find((s: any) => {
                const sId = s.session_id || s.sessionId;
                const normalizedSId = String(sId || '').trim();
                return normalizedSId === normalizedMessageSessionId && s.status === 'active';
              });
              
              if (session) {
                console.log('✅ [前端] 从后端找到会话，添加到列表并增加未读计数:', normalizedMessageSessionId);
                // 更新会话列表
                setMySessions((prev: any[]) => {
                  const exists = prev.some((s: any) => {
                    const sId = s.sessionId || s.session_id;
                    return String(sId || '').trim() === normalizedMessageSessionId;
                  });
                  if (!exists) {
                    const newSession = {
                      sessionId: session.session_id || session.sessionId,
                      session_id: session.session_id || session.sessionId,
                      userId: session.user_id || session.userId,
                      user_id: session.user_id || session.userId,
                      username: session.username || `用户${session.user_id || session.userId}`,
                      status: session.status || 'active',
                      priority: session.priority || 'normal',
                      timestamp: session.created_at || session.createdAt || new Date().toISOString(),
                      startedAt: session.started_at || session.startedAt,
                      endedAt: session.ended_at || session.endedAt,
                    };
                    return [...prev, newSession].sort((a: any, b: any) => 
                      new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
                    );
                  }
                  return prev;
                });
                
                // 增加未读计数
                setUnreadMessageCounts(prev => {
                  const newCount = (prev[normalizedMessageSessionId] || 0) + 1;
                  console.log('✅ [前端] 新增会话并更新未读消息计数:', normalizedMessageSessionId, newCount);
                  return {
                    ...prev,
                    [normalizedMessageSessionId]: newCount
                  };
                });
                return; // 找到了，提前返回
              } else {
                console.warn('⚠️ [前端] 后端也未找到会话或会话状态不是active:', {
                  messageSessionId: normalizedMessageSessionId,
                  availableSessions: sessions.map((s: any) => ({
                    session_id: s.session_id,
                    sessionId: s.sessionId,
                    status: s.status
                  }))
                });
              }
            }
          }).catch((error) => {
            console.error('❌ [前端] 从后端加载会话列表失败:', error);
          });
        }
        
        // 从我的会话列表中查找用户信息，如果不在列表中则添加
        chatAPI.getSessions().then((resp: any) => {
          if (resp?.data?.code === 200) {
            const sessions = resp.data.data?.list || resp.data.data || [];
            const session = sessions.find((s: any) => {
              const sId = s.session_id || s.sessionId;
              return String(sId || '').trim() === normalizedMessageSessionId;
            });
            
            if (session) {
              const username = session.username || `用户${session.user_id || session.userId}`;
              
              // 检查该会话是否已在 mySessions 中，如果不在则添加
              setMySessions((prev: any[]) => {
                const exists = prev.some((s: any) => {
                  const sId = s.sessionId || s.session_id;
                  return String(sId || '').trim() === normalizedMessageSessionId;
                });
                
                if (!exists && session.status === 'active') {
                  // 如果不在列表中且状态为active，添加该会话
                  const newSession = {
                    sessionId: session.session_id || session.sessionId,
                    session_id: session.session_id || session.sessionId,
                    userId: session.user_id || session.userId,
                    user_id: session.user_id || session.userId,
                    username: username,
                    status: session.status || 'active',
                    priority: session.priority || 'normal',
                    timestamp: session.created_at || session.createdAt || new Date().toISOString(),
                    startedAt: session.started_at || session.startedAt,
                    endedAt: session.ended_at || session.endedAt,
                  };
                  
                  console.log('📬 [前端] 将会话添加到列表:', newSession);
                  
                  // 添加会话后，同时增加未读计数
                  setUnreadMessageCounts(prev => {
                    const newCount = (prev[normalizedMessageSessionId] || 0) + 1;
                    console.log('✅ [前端] 添加会话并更新未读消息计数:', normalizedMessageSessionId, newCount);
                    return {
                      ...prev,
                      [normalizedMessageSessionId]: newCount
                    };
                  });
                  
                  // 按时间排序，最新的在前
                  return [...prev, newSession].sort((a: any, b: any) => 
                    new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
                  );
                }
                
                return prev;
              });
              
              // 显示可点击的通知，点击后切换会话
              message.info({
                content: t('dashboard.newMessage', { username }),
                duration: 5,
                onClick: () => {
                  console.log('📬 [前端] 用户点击通知，切换到会话:', normalizedMessageSessionId);
                  setCurrentSession({
                    sessionId: normalizedMessageSessionId,
                    session_id: normalizedMessageSessionId,
                    userId: session.user_id || session.userId,
                    user_id: session.user_id || session.userId,
                    username: username,
                    email: session.email,
                    avatar: session.avatar,
                    status: 'active',
                    customerServiceId: customerService?.id
                  });
                  
                  // 清零未读计数
                  setUnreadMessageCounts(prev => {
                    const newCounts = { ...prev };
                    delete newCounts[normalizedMessageSessionId];
                    return newCounts;
                  });
                  
                  socketService.joinRoom(`session_${normalizedMessageSessionId}`);
                  // 刷新会话列表以确保数据最新
                  loadMySessions();
                }
              });
            } else {
              // 如果会话不在后端返回的列表中，刷新整个列表（可能是新接受的会话）
              console.log('📬 [前端] 会话不在列表中，刷新会话列表');
              loadMySessions();
            }
          }
        }).catch((error) => {
          console.error('❌ [前端] 加载会话信息失败:', error);
          // 即使出错也刷新列表，以防有新会话
          loadMySessions();
        });
      }
    };

    // 新用户等待（同一用户只保留最新一条）
    const handleNewWaitingUser = (data: any) => {
      // 仅处理发给当前客服的等待会话
      if (customerService?.id && data?.customerServiceId && data.customerServiceId !== customerService.id) {
        return;
      }
      console.log('📬 [前端] 收到新用户等待事件:', data);
      console.log('📬 [前端] 会话ID:', data.sessionId, '用户ID:', data.userId, '用户名:', data.username);
      setWaitingUsers((prev:any[]) => {
        console.log('📬 [前端] 当前等待列表长度:', prev.length, '列表:', prev.map((u:any) => ({ sessionId: u.sessionId, userId: u.userId })));
        const others = prev.filter(item => item.userId !== data.userId);
        const next = [data, ...others];
        // 按时间倒序
        const sorted = next.sort((a:any,b:any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        console.log('📬 [前端] 更新后等待列表长度:', sorted.length, '列表:', sorted.map((u:any) => ({ sessionId: u.sessionId, userId: u.userId })));
        return sorted;
      });
      message.info(t('dashboard.newWaitingUser', { username: data.username || t('chat.user') + data.userId }));
    };

    // 会话被接受
    const handleSessionAccepted = (data: any) => {
      console.log('✅ [前端] ========== 收到会话接受成功事件 ==========');
      console.log('✅ [前端] 事件数据:', JSON.stringify(data, null, 2));
      console.log('✅ [前端] 当前会话状态（收到事件前）:', currentSession);
      
      // 重要：无论当前会话是什么，接受的新会话都应该成为当前会话
      // 优先使用广播数据中的用户信息（后端从数据库查询，最准确）
      const sessionId = data.sessionId || data.session_id;
      
      // 从等待列表中查找用户信息（作为备用）
      const waitingUser = waitingUsers.find((u:any) => u.sessionId === sessionId);
      
      // 设置新的当前会话（接受后立即切换为当前会话）
      // 优先使用广播数据，如果没有则使用等待列表中的信息
      const newCurrentSession = {
        session_id: sessionId,
        sessionId: sessionId,
        status: data.status || 'active', // 使用广播数据中的状态，确保是 active
        customerServiceId: data.customerServiceId || data.customer_service_id,
        customer_service_id: data.customer_service_id || data.customerServiceId,
        user_id: data.user_id || data.userId || waitingUser?.userId || waitingUser?.user_id,
        userId: data.userId || data.user_id || waitingUser?.userId || waitingUser?.user_id,
        username: data.username || waitingUser?.username || `用户${data.userId || data.user_id || ''}`,
        email: data.email || waitingUser?.email || '',
        avatar: data.avatar || waitingUser?.avatar || '',
      };
      
      console.log('✅ [前端] 设置新会话为当前会话:', newCurrentSession);
      console.log('✅ [前端] 会话ID验证:', {
        broadcastSessionId: sessionId,
        newSessionSessionId: newCurrentSession.sessionId,
        match: sessionId === newCurrentSession.sessionId
      });
      
      // 立即设置为当前会话
      setCurrentSession(newCurrentSession);
      
      // 从等待列表中移除（按sessionId移除）
      setWaitingUsers((prev:any) => {
        const filtered = prev.filter((user:any) => user.sessionId !== sessionId);
        console.log('✅ [前端] 从等待列表移除，剩余:', filtered.length);
        return filtered;
      });
      
      message.success(t('dashboard.sessionAccepted'));
      loadStatistics();
      // 更新我的会话列表
      loadMySessions();
      
      // 确保加入会话房间
      socketService.joinRoom(`session_${sessionId}`);
      console.log('✅ [前端] 已加入会话房间:', `session_${sessionId}`);
    };

    // 会话被其他客服接受
    const handleSessionTaken = (data: any) => {
      console.log('收到会话被其他客服接受事件:', data);
      // 从等待列表中移除
      setWaitingUsers((prev:any) => prev.filter((user:any) => user.sessionId !== data.sessionId));
      message.info(t('dashboard.sessionTaken'));
      // 刷新统计数据
      loadStatistics();
    };

    // 用户取消等待
    const handleSessionCancelled = (data: any) => {
      console.log('收到用户取消等待事件:', data);
      // 从等待列表中移除
      setWaitingUsers((prev:any) => prev.filter((user:any) => user.sessionId !== data.sessionId));
      message.warning('用户已取消等待');
      
      // 如果当前正在处理这个会话，也要清理
      if (currentSession && (currentSession.session_id === data.sessionId || currentSession.sessionId === data.sessionId)) {
        setCurrentSession(null);
        message.info(t('dashboard.sessionCancelled'));
      }
    };

    // 会话被拒绝
    const handleSessionRejected = (data: any) => {
      console.log('收到会话被拒绝事件:', data);
      // 从等待列表中移除
      setWaitingUsers((prev:any) => prev.filter((user:any) => user.sessionId !== data.sessionId));
      // 调用接口拒绝会话
      message.info(t('dashboard.sessionRejected'));
    };

    // 其他客服上线
    const handleCustomerServiceOnline = (data: any) => {
      console.log('客服端收到客服上线通知:', data);
      setOnlineCustomerServices(prev => {
        const exists = prev.find((cs: any) => cs.id === data.customerServiceId);
        if (exists) {
          return prev.map((cs: any) => cs.id === data.customerServiceId ? { ...cs, status: 'online' } : cs);
        }
        return [ ...prev, { id: data.customerServiceId, username: data.username, status: 'online' } ];
      });
    };

    // 其他客服下线
    const handleCustomerServiceOffline = (data: any) => {
      console.log('客服端收到客服下线通知:', data);
      setOnlineCustomerServices(prev => prev.filter((cs: any) => cs.id !== data.customerServiceId));
    };

    // 新会话通知（用户直接与客服聊天）
    const handleNewSession = (data: any) => {
      console.log('客服端收到新会话通知:', data);
      // 将新会话添加到当前会话
      setCurrentSession({
        // 统一提供两种字段，兼容 ChatInterface 内部逻辑
        sessionId: data.sessionId,
        session_id: data.sessionId,
        userId: data.userId,
        user_id: data.userId,
        username: data.username,
        status: 'active',
        message: t('dashboard.userConnected') || 'User connected'
      });
      
      // 客服加入会话房间以接收消息
      if (socketService.getSocket()) {
        socketService.getSocket().emit('join_session', { sessionId: data.sessionId });
        console.log('客服加入会话房间:', data.sessionId);
      }
      
      message.success(`用户 ${data.username} 已连接`);
    };

    // 成功加入会话房间
    const handleSessionJoined = (data: any) => {
      console.log('客服端成功加入会话房间:', data);
    };

    // 监听会话结束事件
    const handleSessionEnded = (data: any) => {
      console.log('客服端收到会话结束事件:', data);
      
      // 如果当前会话被结束，清空当前会话
      if (currentSession && (currentSession.session_id === data.sessionId || currentSession.sessionId === data.sessionId)) {
        setCurrentSession(null);
        message.info(t('dashboard.sessionEnded'));
      }
      
      // 刷新会话列表和统计数据
      loadMySessions();
      loadStatistics();
    };

    // 注册所有其他事件监听器
    socketService.on('new_message', handleNewMessage);
    socketService.on('new_waiting_user', handleNewWaitingUser);
    socketService.on('session_accepted', handleSessionAccepted);
    socketService.on('session_taken', handleSessionTaken);
    socketService.on('session_cancelled', handleSessionCancelled);
    socketService.on('session_rejected', handleSessionRejected);
    socketService.on('customer_service_online', handleCustomerServiceOnline);
    socketService.on('customer_service_offline', handleCustomerServiceOffline);
    socketService.on('new_session', handleNewSession);
    socketService.on('session_joined', handleSessionJoined);
    socketService.on('session_ended', handleSessionEnded);

    return () => {
      // 清理所有事件监听器，避免重复注册
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('status_updated', handleStatusUpdated);
      socketService.off('login_success', handleLoginSuccess);
      socketService.off('login_error', handleLoginError);
      socketService.off('error', handleError);
      // 不移除 new_message 的监听，避免影响 ChatInterface 内部监听
      socketService.off('session_accepted', handleSessionAccepted);
      socketService.off('session_taken', handleSessionTaken);
      socketService.off('new_waiting_user', handleNewWaitingUser);
      socketService.off('session_cancelled', handleSessionCancelled);
      socketService.off('session_rejected', handleSessionRejected);
      socketService.off('customer_service_online', handleCustomerServiceOnline);
      socketService.off('customer_service_offline', handleCustomerServiceOffline);
      socketService.off('new_message', handleNewMessage);
      socketService.off('session_ended', handleSessionEnded);
      socketService.off('new_session', handleNewSession);
      socketService.off('session_joined', handleSessionJoined);
    };
  }, [loadMySessions, loadStatistics, loadWaitingSessions, currentSession, customerService?.id, restoreActiveSession, loadOnlineCustomerServices, t, waitingUsers]); // 添加必要的依赖

  // 登录成功后拉取一次在线客服列表
  useEffect(() => {
    loadOnlineCustomerServices();
  }, [loadOnlineCustomerServices]);

  // 查看会话详情 -> 改为直接进入聊天界面
  const handleViewSession = async (session: any) => {
    // 切换当前会话
    const sessionId = session.sessionId || session.session_id;
    setCurrentSession({
      // 同时提供两种字段，兼容内部组件
      sessionId,
      session_id: sessionId,
      userId: session.userId || session.user_id,
      user_id: session.userId || session.user_id,
      username: session.username,
      email: session.email,
      avatar: session.avatar,
      status: session.status || 'active',
    });

    // 统一sessionId格式
    const normalizedSessionId = String(sessionId || '').trim();
    
    // 清零该会话的未读消息计数
    setUnreadMessageCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[normalizedSessionId];
      console.log('✅ [前端] 查看会话，清零未读计数:', normalizedSessionId);
      return newCounts;
    });

    // 让客服加入会话房间
    if (socketService.getSocket() && normalizedSessionId) {
      socketService.joinRoom(`session_${normalizedSessionId}`);
    }

    // 预加载聊天记录已移至ChatInterface组件处理
  };

  // 接受等待中的会话
  const handleAcceptWaitingSession = (sessionId: string) => {
    console.log('📤 [前端] ========== 开始接受会话 ==========');
    console.log('📤 [前端] 会话ID:', sessionId);
    console.log('📤 [前端] 当前会话状态（接受前）:', currentSession);
    console.log('📤 [前端] 等待用户列表:', waitingUsers);
    
    // 保存原始等待用户信息，用于错误回退
    const waitingUser = waitingUsers.find(user => user.sessionId === sessionId);
    if (!waitingUser) {
      console.error('❌ [前端] 未找到等待中的会话:', sessionId);
      message.error(t('dashboard.sessionNotFound'));
      return;
    }
    
    console.log('📤 [前端] 找到等待用户:', waitingUser);
    
    // 发送接受会话请求（先发送请求，等后端确认后再更新状态）
    console.log('📤 [前端] 准备发送 accept_session 事件...');
    socketService.acceptSession(sessionId);
    
    // 加入会话房间
    console.log('📤 [前端] 准备加入会话房间...');
    socketService.joinRoom(`session_${sessionId}`);
    
    // 从等待列表中移除（优化UI，立即移除）
    setWaitingUsers((prev:any) => prev.filter((user:any) => user.sessionId !== sessionId));
    
      message.success(t('dashboard.sessionAccepted'));
    console.log('✅ [前端] 接受会话请求已发送，等待后端响应');
    
    // 注意：不在这里设置 currentSession，等 session_accepted 事件确认后再设置
    // 这样可以确保后端已经成功更新数据库
  };

  // 拒绝等待中的会话
  const handleRejectWaitingSession = (sessionId: string) => {
    console.log('拒绝会话:', sessionId);
    
    socketService.rejectSession(sessionId);
    message.success('正在拒绝会话...');
    
    // 立即从等待列表中移除
    setWaitingUsers((prev: any[]) => prev.filter((user: any) => user.sessionId !== sessionId));
  };

  // 更新个人信息
  const handleUpdateProfile = async (values: any) => {
    try {
      const response = await customerServiceAPI.updateProfile(values);
      if (response.data.code === 200) {
        message.success(t('dashboard.updateSuccess'));
        setProfileModalVisible(false);
        loadCustomerService();
      }
    } catch (error) {
      message.error(t('dashboard.updateFailed'));
    }
  };

  // 上传头像
  const handleUploadAvatar = async (file: File) => {
    try {
      const response = await customerServiceAPI.uploadAvatar(file);
      if (response.data.code === 200) {
        message.success('头像上传成功');
        loadCustomerService();
      }
    } catch (error) {
      message.error('头像上传失败');
    }
    return false;
  };

  // 手动连接Socket
  const handleConnectSocket = () => {
    const customerServiceToken = localStorage.getItem('customerServiceToken');
    if (customerServiceToken) {
      console.log('手动连接Socket');
      socketService.connect(customerServiceToken);
      message.info('正在连接Socket...');
    } else {
      message.error('未找到客服Token，请重新登录');
    }
  };

  // 更新状态
  const handleStatusChange = (status: 'online' | 'offline' | 'busy') => {
    if (socketService.isConnected()) {
      socketService.updateStatus(status);
      // 更新本地状态
      setCustomerService((prev:any) => prev ? { ...prev, status } : null);
      message.success(`状态已更新为${status === 'online' ? '在线' : status === 'busy' ? '忙碌' : '离线'}`);
    } else {
      message.error('Socket未连接，无法更新状态');
    }
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
        localStorage.removeItem('customerServiceToken');
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

  // 状态菜单
  const statusMenu = (
    <Menu>
      {!isConnected && (
        <Menu.Item key="connect" onClick={handleConnectSocket}>
          <WifiOutlined style={{ color: '#1890ff' }} /> {t('dashboard.connectSocket')}
        </Menu.Item>
      )}
      <Menu.Item key="online" onClick={() => handleStatusChange('online')} disabled={!isConnected}>
        <CheckCircleOutlined style={{ color: '#52c41a' }} /> {t('dashboard.online')}
      </Menu.Item>
      <Menu.Item key="busy" onClick={() => handleStatusChange('busy')} disabled={!isConnected}>
        <ClockCircleOutlined style={{ color: '#faad14' }} /> {t('dashboard.busy')}
      </Menu.Item>
      <Menu.Item key="offline" onClick={() => handleStatusChange('offline')} disabled={!isConnected}>
        <LogoutOutlined style={{ color: '#f5222d' }} /> {t('dashboard.offline')}
      </Menu.Item>
    </Menu>
  );

  if (!customerService) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {/* 头部 */}
      <Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: isMobile ? '0 12px' : '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: isMobile ? '56px' : '64px',
          flexShrink: 0,
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              fontSize: isMobile ? 14 : 16,
              width: isMobile ? 28 : 32,
              height: isMobile ? 28 : 32,
              marginRight: isMobile ? 8 : 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
          <MessageOutlined style={{ fontSize: isMobile ? '20px' : '24px', color: '#1890ff', marginRight: isMobile ? '8px' : '12px' }} />
          <Title 
            level={isMobile ? 5 : 4} 
            style={{ 
              margin: 0,
              fontSize: isMobile ? 16 : undefined,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: isMobile ? 120 : 'unset'
            }}
          >
            {t('dashboard.title')}
          </Title>
        </div>

        <Space size={isMobile ? 8 : 12}>
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
                minWidth: 40,
                padding: '4px 0px',
                background: 'transparent',
                border: 'none',
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
          <Dropdown overlay={statusMenu} trigger={['click']}>
            <Button size={isMobile ? 'small' : 'middle'} type={isMobile ? 'default' : 'default'}>
              <Badge
                status={!isConnected ? 'error' : (customerService?.status === 'online' || (!customerService && isConnected)) ? 'success' : customerService?.status === 'busy' ? 'warning' : 'error'}
                text={
                  isMobile
                    ? undefined
                    : (!isConnected 
                    ? t('dashboard.notConnected')
                    : (customerService?.status === 'online' || (!customerService && isConnected))
                      ? t('dashboard.online')
                      : customerService?.status === 'busy' 
                        ? t('dashboard.busy')
                            : t('dashboard.offline'))
                }
              />
            </Button>
          </Dropdown>

          <Dropdown overlay={userMenu} trigger={['click']}>
            <Button type="text" size={isMobile ? 'small' : 'middle'}>
              <Space size={isMobile ? 6 : 8}>
                <Avatar
                  size={isMobile ? 28 : 32}
                  src={getImageUrl(customerService.avatar)}
                  icon={<UserOutlined />}
                />
                <span style={{
                  maxWidth: isMobile ? 80 : 160,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {customerService.username}
                </span>
              </Space>
            </Button>
          </Dropdown>
        </Space>
      </Header>

      <Layout style={{ height: 'calc(100vh - 64px)', overflow: 'hidden', position: 'relative' }}>
        {/* 移动端遮罩层 */}
        {isMobile && !sidebarCollapsed && (
          <div
            style={{
              position: 'fixed',
              top: 64,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              zIndex: 998,
              transition: 'opacity 0.2s',
            }}
            onClick={() => setSidebarCollapsed(true)}
          />
        )}
        
        {/* 侧边栏 */}
        <Sider
          collapsible
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
          width={300}
          collapsedWidth={0}
          breakpoint="md"
          style={{
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
            height: '100%',
            overflow: 'hidden',
            position: isMobile && !sidebarCollapsed ? 'fixed' : 'relative',
            zIndex: isMobile && !sidebarCollapsed ? 999 : 1,
            transition: 'all 0.2s',
            left: isMobile && sidebarCollapsed ? -300 : 0,
          }}
          trigger={null}
        >
          <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
            {/* 统计卡片 */}
            <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title={t('dashboard.totalSessions')}
                    value={statistics?.totalSessions || 0}
                    prefix={<MessageOutlined />}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title={t('dashboard.activeSessions')}
                    value={statistics?.activeSessions || 0}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title={t('dashboard.todaySessions')}
                    value={statistics?.todaySessions || 0}
                    prefix={<ClockCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" onClick={() => { setTodayModalVisible(true); setSelectedTodayUser(null); setTodayUserMessages([]); loadTodayUsers(); }} hoverable>
                  <Statistic
                    title={t('dashboard.todayMessages')}
                    value={statistics?.todayMessages || 0}
                    prefix={<MessageOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {/* 在线客服列表（仅客服角色） */}
            {onlineCustomerServices.length > 0 && (
              <Card title={t('dashboard.onlineCustomerServices')} size="small" style={{ marginBottom: '16px' }}>
                <List
                  dataSource={onlineCustomerServices}
                  renderItem={(cs: any) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar style={{ backgroundColor: '#52c41a' }}>{(cs.username || t('dashboard.customerService')).slice(0,2)}</Avatar>}
                        title={
                            <Space direction="horizontal" size={8}>
                            <Text strong>{cs.username || t('dashboard.customerService') + cs.id}</Text>
                            <Tag color="green">{t('dashboard.online')}</Tag>
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {cs.username || t('dashboard.customerService')}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {/* 等待用户列表 */}
            {waitingUsers.length > 0 && (
              <Card title={t('dashboard.waitingAccess')} size="small" style={{ marginBottom: '16px' }}>
                <List
                  dataSource={waitingUsers}
                  renderItem={(user: any) => {
                    const username = user.username || t('chat.user') + user.userId;
                    return (
                    <List.Item
                        style={{ 
                          alignItems: 'flex-start',
                          padding: '12px 16px',
                          marginBottom: 8,
                          flexDirection: 'column'
                        }}
                        >
                        <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start', marginBottom: 8 }}>
                          <Avatar style={{ backgroundColor: '#f56a00', marginRight: 12, flexShrink: 0 }}>
                            {username?.toString().slice(0, 2)}
                          </Avatar>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 8,
                              marginBottom: 4
                            }}>
                              <Text strong style={{ fontSize: 14 }}>
                                {username}
                              </Text>
                              <Tag color="blue" style={{ flexShrink: 0 }}>{t('dashboard.waiting')}</Tag>
                            </div>
                            <div style={{ fontSize: 12, color: '#666', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ whiteSpace: 'nowrap' }}>
                              <Text type="secondary">{t('dashboard.sessionId')}: </Text>
                              <Text code style={{ fontSize: 11 }}>{user.sessionId}</Text>
                            </div>
                              <div style={{ whiteSpace: 'nowrap' }}>
                              <Text type="secondary">{t('dashboard.waitingTime')}: </Text>
                              <Text type="secondary">{Math.floor((Date.now() - new Date(user.timestamp).getTime()) / 60000)} {t('dashboard.minutes')}</Text>
                            </div>
                          </div>
                          </div>
                        </div>
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <Button
                          type="primary"
                          size="small"
                            onClick={() => handleAcceptWaitingSession(user.sessionId)}
                        >
                            接受
                        </Button>
                          <Button
                            danger
                            size="small"
                            onClick={() => handleRejectWaitingSession(user.sessionId)}
                          >
                            拒绝
                          </Button>
                            </div>
                    </List.Item>
                    );
                  }}
                />
              </Card>
            )}

            {/* 当前会话列表（显示所有已接受的活跃会话） */}
            {mySessions.filter((s: any) => s.status === 'active').length > 0 && (
              <Card title={t('dashboard.currentSession')} size="small">
                <List
                  dataSource={mySessions
                    .filter((s: any) => s.status === 'active')
                    .sort((a: any, b: any) => {
                      // 统一sessionId格式
                      const aSessionId = String((a.sessionId || a.session_id || '').trim());
                      const bSessionId = String((b.sessionId || b.session_id || '').trim());
                      const aUnreadCount = unreadMessageCounts[aSessionId] || 0;
                      const bUnreadCount = unreadMessageCounts[bSessionId] || 0;
                      
                      // 有未读消息的优先，未读数量多的排在最前
                      if (aUnreadCount > 0 && bUnreadCount > 0) {
                        return bUnreadCount - aUnreadCount; // 未读数多的在前
                      }
                      if (aUnreadCount > 0 && bUnreadCount === 0) {
                        return -1; // a有未读，b没有，a在前
                      }
                      if (aUnreadCount === 0 && bUnreadCount > 0) {
                        return 1; // a没有未读，b有，b在前
                      }
                      
                      // 都没有未读消息，按时间倒序（最新的在前）
                      const aTime = new Date(a.timestamp || a.startedAt || 0).getTime();
                      const bTime = new Date(b.timestamp || b.startedAt || 0).getTime();
                      return bTime - aTime;
                    })}
                  renderItem={(session: any) => {
                    const sessionId = session.session_id || session.sessionId;
                    // 统一sessionId格式，确保与未读计数key一致
                    const normalizedSessionId = String(sessionId || '').trim();
                    const normalizedCurrentSessionId = currentSession ? String(currentSession.sessionId || currentSession.session_id || '').trim() : '';
                    const isCurrent = normalizedSessionId === normalizedCurrentSessionId && normalizedCurrentSessionId !== '';
                    const username = session.username || t('chat.user') + (session.user_id || session.userId);
                    return (
                      <List.Item
                        style={{
                          backgroundColor: isCurrent ? '#e6f7ff' : 'transparent',
                          borderLeft: isCurrent ? '3px solid #1890ff' : '3px solid transparent',
                          padding: '8px 60px 8px 8px',
                          marginBottom: 4,
                          borderRadius: 4,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'flex-start',
                          position: 'relative',
                          minHeight: 'auto'
                        }}
                        onClick={() => handleViewSession(session)}
                      >
                        <Avatar 
                          size="small"
                          style={{ 
                            backgroundColor: isCurrent ? '#1890ff' : '#52c41a',
                            marginRight: 8,
                            marginLeft: 0,
                            flexShrink: 0
                          }}
                        >
                          {username.toString().slice(0, 2)}
                        </Avatar>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                          {/* 未读消息数量提醒 */}
                          {!isCurrent && unreadMessageCounts[normalizedSessionId] > 0 && (
                            <div style={{ 
                              marginBottom: 4,
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              <Badge 
                                count={unreadMessageCounts[normalizedSessionId]} 
                                overflowCount={99}
                                style={{ 
                                  backgroundColor: '#ff4d4f',
                                  fontSize: '11px',
                                  minWidth: '18px',
                                  height: '18px',
                                  lineHeight: '18px',
                                  padding: '0 6px'
                                }}
                              >
                                <span style={{ 
                                  fontSize: 11, 
                                  color: '#ff4d4f',
                                  fontWeight: 'bold'
                                }}>
                                  {unreadMessageCounts[normalizedSessionId]} 条未读消息
                                </span>
                              </Badge>
                            </div>
                          )}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 6,
                            marginBottom: 4,
                            flexWrap: 'wrap'
                          }}>
                            <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                              {username}
                            </Text>
                              {isCurrent && <Tag color="blue" style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>{t('dashboard.current')}</Tag>}
                            <Tag color="green" style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>{t('dashboard.inProgress')}</Tag>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Text type="secondary" style={{ fontSize: '11px', lineHeight: 1.4 }}>
                              {t('dashboard.sessionId')}: <Text code style={{ fontSize: 10 }}>{sessionId}</Text>
                            </Text>
                            {session.startedAt && (
                              <Text type="secondary" style={{ fontSize: '11px', lineHeight: 1.4 }}>
                                {t('dashboard.startTime')}: {dayjs(session.startedAt).format('MM-DD HH:mm')}
                              </Text>
                            )}
                          </div>
                        </div>
                        <Button
                          type={isCurrent ? 'primary' : 'link'}
                          size="small"
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 1
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewSession(session);
                          }}
                        >
                          {isCurrent ? t('common.viewing') : t('common.view')}
                        </Button>
                      </List.Item>
                    );
                  }}
                />
              </Card>
            )}
          </div>
        </Sider>

        {/* 主内容区 */}
        <Content
          style={{
            height: '100%',
            overflow: 'hidden',
            transition: 'margin-left 0.2s',
          }}
        >
          <ChatInterface
            currentSession={currentSession}
            onSessionChange={(session) => {
              setCurrentSession(session);
              // 当会话结束时（session为null），刷新统计数据
              if (!session) {
                loadStatistics();
              }
            }}
          />
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
                src={getImageUrl(customerService.avatar)}
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

          <Form.Item
            name="maxConcurrentChats"
            label={t('dashboard.maxConcurrentChats')}
          >
            <Input type="number" min={1} max={20} />
          </Form.Item>
        </Form>
      </Modal>
      {contextHolder}
      
      {/* 今日消息模态框 */}
      <Modal
        title={selectedTodayUser ? `消息记录 - ${selectedTodayUser.username}` : '今日消息 - 今日聊天用户'}
        open={todayModalVisible}
        onCancel={() => { 
          setTodayModalVisible(false); 
          setSelectedTodayUser(null); 
          setTodayUserMessages([]); 
          setTodayMessagePage(1);
          setTodayOnlyToday(false); // 默认关闭
          // 清空本地状态
        }}
        footer={null}
        width={800}
      >
        {!selectedTodayUser ? (
          <List
            loading={todayLoading}
            dataSource={todayUsers}
            locale={{ emptyText: t('dashboard.todayNoMessages') }}
            renderItem={(u: any) => (
              <List.Item
                actions={[
                  <Button 
                    key="view" 
                    type="link" 
                  onClick={() => { 
                      setSelectedTodayUser(u); 
                      setTodayMessagePage(1);
                      // 重置分页并重新加载
                    loadTodayMessagesForUser(u.sessionId, 1, false, todayOnlyToday); 
                    }}
                  >
                    {t('common.view')}
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar style={{ backgroundColor: '#52c41a' }}>{u.username?.charAt(0) || t('chat.user').charAt(0)}</Avatar>}
                  title={<span>{u.username || t('chat.user') + u.userId}</span>}
                  description={<span>{t('dashboard.sessionId')}: <Typography.Text code>{u.sessionId}</Typography.Text></span>}
                />
              </List.Item>
            )}
          />
        ) : (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <span>{t('dashboard.todayOnly')}:</span>
                <Switch
                  checked={todayOnlyToday}
                  onChange={(checked) => {
                    setTodayOnlyToday(checked);
                    setTodayMessagePage(1);
                    // 使用最新开关值请求
                    loadTodayMessagesForUser(selectedTodayUser.sessionId, 1, false, checked);
                  }}
                />
              </Space>
              <Button 
                type="link" 
                onClick={() => { 
                  setSelectedTodayUser(null); 
                  setTodayMessagePage(1);
                  setTodayUserMessages([]);
                  // 清空本地状态
                }}
              >
                {t('common.back')}
              </Button>
            </div>
            <List
              loading={todayLoading}
              dataSource={todayUserMessages}
              locale={{ emptyText: todayOnlyToday ? t('dashboard.todayNoMessages') : t('dashboard.noMessages') }}
              style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: 16 }}
              renderItem={(m: any) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <span>
                        {dayjs((m as any).created_at || (m as any).createdAt).format('YYYY-MM-DD HH:mm:ss')} - {m.sender_name}
                      </span>
                    }
                    description={
                      <div>
                        {m.message_type === 'text' ? (
                          <Typography.Text>{m.content}</Typography.Text>
                        ) : m.message_type === 'image' ? (
                          <span>[图片] {m.file_url && <a href={getImageUrl(m.file_url)} target="_blank" rel="noopener noreferrer">查看</a>}</span>
                        ) : m.message_type === 'file' ? (
                          <span>[文件] {m.file_name} {m.file_url && <a href={getFileUrl(m.file_url)} target="_blank" rel="noopener noreferrer">下载</a>}</span>
                        ) : (
                          <Typography.Text>{m.content}</Typography.Text>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
            {(todayUserMessages.length > 0 || todayMessageTotal > 0) && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Pagination
                  current={todayMessagePage}
                  pageSize={todayMessagePageSize}
                  total={todayMessageTotal}
                  showSizeChanger={false}
                  showQuickJumper
                  showTotal={(total, range) => t('dashboard.page', { from: range[0], to: range[1], total })}
                  onChange={(page) => {
                    setTodayMessagePage(page);
                    loadTodayMessagesForUser(selectedTodayUser.sessionId, page, false, todayOnlyToday);
                    // 滚动到顶部
                    const listContainer = document.querySelector('.ant-list');
                    if (listContainer) {
                      listContainer.scrollTop = 0;
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
      
      {/* 已移除弹窗，直接在主界面展示聊天 */}
    </Layout>
  );
};

export default Dashboard;



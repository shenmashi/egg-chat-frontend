import io from 'socket.io-client';

// Socket连接URL配置
// 优先 REACT_APP_SOCKET_URL；开发环境直接连接后端（后端已配置CORS）；生产环境使用同源
const SOCKET_URL = (() => {
  // 如果设置了环境变量，直接使用
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }
  
  // 开发环境：直接连接到后端（后端已配置CORS允许跨域）
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined) {
    // 检查是否是 localhost，如果是则直接连接后端
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:7001';
      }
    }
  }
  
  // 生产环境：使用同源（通过代理或同域名）
  try {
    return window.location.origin;
  } catch {
    return 'http://localhost:7001'; // 兜底
  }
})();

// 输出最终连接地址（方便调试）
console.log('📍 Socket连接地址:', SOCKET_URL);
console.log('   环境变量 REACT_APP_SOCKET_URL:', process.env.REACT_APP_SOCKET_URL || '未设置');
console.log('   当前环境:', process.env.NODE_ENV);
console.log('   连接方式:', process.env.REACT_APP_SOCKET_URL ? '环境变量指定' : '同源(走setupProxy)');

class SocketService {
  private socket: any | null = null;
  private token: string | null = null;
  private connecting: boolean = false;
  // 将待发送的事件在断线时排队（轻量兜底）
  private pendingOnceOnConnect: Array<() => void> = [];
  // 重连相关
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 30; // 尝试更长时间的自动重连
  private reconnectDelay = 1000; // 初始延迟，后续指数退避至 30s 上限
  private isReconnecting = false;
  // 房间管理
  private currentRooms: Set<string> = new Set();
  private userType: 'user' | 'customer_service' | null = null;
  private userId: number | null = null;
  // 防止重复连接的锁
  private connectLock = false;
  private lastConnectTime = 0;
  private connectCooldown = 3000; // 3秒冷却时间
  private isInitialConnection = true; // 标记是否为初始化连接（页面加载时）

  // 连接Socket.IO
  connect(token: string, isInitial = false) {
    console.log('=== Socket连接开始 ===');
    console.log('连接URL:', SOCKET_URL);
    console.log('Token长度:', token?.length || 0);
    console.log('Token前20字符:', token?.substring(0, 20) || 'none');
    console.log('当前状态:', {
      hasSocket: !!this.socket,
      socketConnected: this.socket?.connected,
      connecting: this.connecting,
      connectLock: this.connectLock,
      lastConnectTime: this.lastConnectTime
    });
    
    // 如果已经在连接或已连接，且token一致，直接复用
    if (this.socket && (this.socket.connected || this.connecting) && this.token === token) {
      console.log('检测到已有Socket连接/正在连接，复用现有连接');
      return this.socket;
    }
    
    // 防止频繁重复连接（冷却机制）
    // 只在已有连接记录且距离上次连接时间太短时才应用冷却
    const now = Date.now();
    
    // 检查并清理残留的连接锁状态
    // 如果connectLock为true但满足以下任一条件，说明是残留状态：
    // 1. 没有socket实例
    // 2. socket存在但未连接且不在连接中
    // 3. 锁定时间过长（超过10秒，说明之前的连接已经失败或超时）
    if (this.connectLock) {
      const lockDuration = this.lastConnectTime > 0 ? (now - this.lastConnectTime) : 0;
      const shouldReset = 
        !this.socket || // 没有socket实例
        (!this.socket.connected && !this.connecting) || // socket未连接且不在连接中
        (lockDuration > 10000); // 锁定超过10秒
      
      if (shouldReset) {
        console.warn('⚠️ 检测到残留的连接锁状态，重置连接锁', {
          hasSocket: !!this.socket,
          socketConnected: this.socket?.connected,
          connecting: this.connecting,
          lockDuration: `${Math.ceil(lockDuration / 1000)}秒`
        });
        this.connectLock = false;
        this.connecting = false;
      } else {
        // 连接锁有效，正在连接中
        console.log('⏳ 连接已锁定，正在连接中...');
        return this.socket;
      }
    }
    
    // 只有在已有连接记录且距离上次连接时间太短时才应用冷却
    // 页面刷新/初始化连接或 lastConnectTime 为 0 时，不应该应用冷却限制
    // isInitial 为 true 表示这是页面加载时的初始化连接，也应该跳过冷却
    if (!isInitial && this.lastConnectTime > 0 && (now - this.lastConnectTime < this.connectCooldown)) {
      const remaining = this.connectCooldown - (now - this.lastConnectTime);
      if (remaining > 0) {
        console.log(`⏳ 连接冷却中，请等待 ${Math.ceil(remaining / 1000)} 秒后再试`);
        return this.socket;
      }
    }
    
    // 如果是初始化连接，重置初始化标记
    if (isInitial) {
      this.isInitialConnection = false;
      console.log('🔄 这是页面初始化连接，跳过冷却限制');
    }
    
    this.connectLock = true;
    this.lastConnectTime = now;

    const tokenChanged = this.token && this.token !== token;
    this.token = token;
    
    // 如已有连接且token变更，才断开重连；否则直接创建/复用
    if (this.socket && (this.socket.connected || this.connecting)) {
      if (tokenChanged) {
        console.log('检测到Token变更，断开旧连接后重连');
        this.socket.disconnect();
      } else {
        console.log('当前已有连接且Token未变更，复用现有连接');
        return this.socket;
      }
    }
    
    // 如果Socket实例存在但已断开，尝试重新连接
    if (this.socket && !this.socket.connected && !this.connecting) {
      console.log('检测到Socket实例存在但已断开，尝试重新连接...');
      // Socket.IO会自动重连，但如果自动重连失败，我们这里手动触发连接
      if (this.socket.disconnected) {
        console.log('Socket处于disconnected状态，手动调用connect()');
        this.socket.connect();
        this.connecting = true;
        return this.socket;
      }
    }
    
    this.connecting = true;
    this.socket = io(SOCKET_URL, {
      path: '/socket.io',            // 与后端保持一致
      transports: ['websocket', 'polling'], // 优先使用websocket（直接连接更高效），失败后降级到polling
      reconnection: true,
      reconnectionAttempts: 10,      // 减少重连次数，避免无限重试
      reconnectionDelay: 2000,       // 重连延迟2秒
      reconnectionDelayMax: 5000,    // 最大延迟5秒
      timeout: 15000,                // 连接超时 15s
      forceNew: false,               // 不强制创建新连接，允许复用
      auth: {
        token: token,
      },
      // 连接配置
      upgrade: true,
      rememberUpgrade: false,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO连接成功！');
      console.log('Socket ID:', this.socket.id);
      console.log('Socket URL:', SOCKET_URL);
      console.log('Socket connected状态:', this.socket.connected);
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.connecting = false;
      this.connectLock = false; // 释放连接锁
      
      // 确保连接状态正确
      if (this.socket && !this.socket.connected) {
        console.warn('⚠️ connect事件触发但socket.connected为false，可能需要等待');
      }
      
      // 重新加入之前的房间
      this.rejoinRooms();
    });

    this.socket.on('disconnect', (reason: string) => {
      console.warn('❌ Socket.IO连接断开');
      console.warn('断开原因:', reason);
      
      // 根据断开原因决定是否释放锁
      if (reason === 'io client disconnect' || reason === 'io server disconnect') {
        // 主动断开，立即释放锁
        this.connectLock = false;
      } else {
        // 网络问题，保持锁一段时间，让Socket.IO自动重连
        // Socket.IO有内置重连机制，不需要手动干预
        this.connecting = false;
        setTimeout(() => {
          this.connectLock = false;
        }, this.connectCooldown);
      }
      
      this.handleDisconnect(reason);
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('❌ Socket.IO连接错误');
      console.error('错误类型:', error?.type || 'unknown');
      console.error('错误消息:', error?.message || error);
      console.error('错误描述:', error?.description || '');
      console.error('连接URL:', SOCKET_URL);
      console.error('Socket实例:', !!this.socket);
      console.error('连接配置:', {
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        timeout: 20000,
        forceNew: false
      });
      
      // 详细错误分析
      if (error?.message?.includes('timeout') || error?.type === 'TransportError') {
        console.error('💡 连接超时，可能的原因：');
        console.error('   1. 后端服务未启动（检查 localhost:7001 是否可访问）');
        console.error('   2. 代理配置问题（检查 setupProxy.js 是否正确加载）');
        console.error('   3. 防火墙或网络问题');
        console.error('   4. WebSocket 升级失败，尝试使用 polling 传输');
        console.error('   5. 如果是开发环境，请检查前端是否在 localhost:3000 运行');
      } else if (error?.message?.includes('xhr poll error') || error?.message?.includes('404')) {
        console.error('💡 代理或路径错误：');
        console.error('   1. 检查 setupProxy.js 是否配置了 /socket.io 代理');
        console.error('   2. 确认后端 Socket.IO 路径为 /socket.io');
        console.error('   3. 尝试直接访问 http://localhost:7001/socket.io/ 查看是否响应');
      }
      
      this.handleConnectError(error);
      this.connecting = false;
      // 连接错误后立即释放锁，允许重试
      // 如果连接失败，不应该阻止后续的重新连接尝试
      this.connectLock = false;
    });

    // 监听重连相关事件，方便调试
    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log(`🔄 Socket重连成功，尝试次数: ${attemptNumber}`);
    });
    
    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log(`🔄 Socket重连尝试 ${attemptNumber}...`);
    });
    
    this.socket.on('reconnect_error', (error: any) => {
      console.error('❌ Socket重连错误:', error);
    });
    
    this.socket.on('reconnect_failed', () => {
      console.error('❌ Socket重连失败，已达到最大重试次数');
    });

    return this.socket;
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // 客服登录
  customerServiceLogin(token: string) {
    if (this.socket) {
      this.socket.emit('customer_service_login', { token });
    }
  }

  // 用户登录
  userLogin(token: string) {
    if (this.socket) {
      console.log('📤 发送用户登录请求');
      console.log('Socket连接状态:', this.socket.connected);
      this.socket.emit('user_login', { token });
    } else {
      console.error('❌ Socket未初始化，无法发送用户登录请求');
    }
  }

  // 接受会话
  acceptSession(sessionId: string) {
    if (this.socket) {
      console.log('📤 [前端] 发送 accept_session 事件:', {
        sessionId,
        socketId: this.socket.id,
        connected: this.socket.connected
      });
      this.socket.emit('accept_session', { sessionId });
      console.log('✅ [前端] accept_session 事件已发送');
    } else {
      console.error('❌ [前端] Socket 未初始化，无法发送 accept_session 事件');
    }
  }

  // 拒绝会话
  rejectSession(sessionId: string) {
    if (this.socket) {
      this.socket.emit('reject_session', { sessionId });
    }
  }

  // 发送消息
  sendMessage(data: {
    sessionId: string;
    content: string;
    messageType?: 'text' | 'image' | 'file' | 'emoji';
    fileData?: any;
  }) {
    if (this.socket) {
      this.socket.emit('send_message', data);
    }
  }

  // 标记消息已读
  markMessageRead(messageId: number) {
    if (this.socket) {
      this.socket.emit('mark_read', { messageId });
    }
  }

  // 获取历史消息
  getHistory(sessionId: string, page = 1, pageSize = 50) {
    if (this.socket) {
      this.socket.emit('get_history', { sessionId, page, pageSize });
    }
  }

  // 更新客服状态
  updateStatus(status: 'online' | 'offline' | 'busy') {
    if (this.socket) {
      this.socket.emit('update_status', { status });
      console.log('发送状态更新:', status);
    } else {
      console.warn('Socket未连接，无法更新状态');
    }
  }

  // 获取当前状态
  getCurrentStatus() {
    return this.socket?.auth?.status || 'offline';
  }

  // 监听事件
  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // 移除监听
  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        // 如果提供了回调，移除特定监听器
        this.socket.off(event, callback);
      } else {
        // 如果没有提供回调，移除该事件的所有监听器
        this.socket.removeAllListeners(event);
      }
    }
  }

  // 获取socket实例
  getSocket() {
    return this.socket;
  }

  // 检查是否正在连接
  isConnecting() {
    return this.connecting || this.connectLock;
  }
  
  // 检查是否可以连接（不在冷却期）
  canConnect() {
    const now = Date.now();
    return !this.connectLock && (now - this.lastConnectTime >= this.connectCooldown);
  }

  // 检查是否已连接
  isConnected() {
    const connected = this.socket?.connected || false;
    // 减少日志输出，避免刷屏
    // if (!connected) {
    //   console.log('⚠️ Socket未连接');
    //   console.log('Socket实例存在:', !!this.socket);
    //   console.log('连接状态:', this.socket?.connected);
    // }
    return connected;
  }

  // 发送事件（支持可选回调ack）
  emit(event: string, data?: any, ack?: (...args: any[]) => void) {
    // 已连接，直接发送
    if (this.socket && this.socket.connected) {
      if (typeof ack === 'function') {
        this.socket.emit(event, data, ack);
      } else if (typeof data !== 'undefined') {
        this.socket.emit(event, data);
      } else {
        this.socket.emit(event);
      }
      return;
    }

    // 未连接时的兜底：尝试重连后在connect时发送一次
    console.warn('Socket未连接，尝试重连后发送事件:', event);
    if (this.token) {
      // 注册一次性回调
      const sendOnce = () => {
        if (!this.socket) return;
        if (typeof ack === 'function') {
          this.socket.emit(event, data, ack);
        } else if (typeof data !== 'undefined') {
          this.socket.emit(event, data);
        } else {
          this.socket.emit(event);
        }
      };
      this.pendingOnceOnConnect.push(sendOnce);

      const flush = () => {
        // 逐个执行并清空
        const queue = [...this.pendingOnceOnConnect];
        this.pendingOnceOnConnect = [];
        queue.forEach(fn => {
          try { fn(); } catch (e) { console.error('重连后发送失败:', e); }
        });
        this.socket?.off('connect', flush);
      };
      // 先移除，避免重复
      this.socket?.off('connect', flush);
      this.socket?.on('connect', flush);

      // 触发重连
      this.connect(this.token);

      // 防止长时间无连接，5秒超时清理监听
      setTimeout(() => this.socket?.off('connect', flush), 5000);
    } else {
      console.warn('无可用token，无法重连发送事件:', event);
    }
  }

  // 测试连接
  testConnection() {
    if (this.socket) {
      this.socket.emit('ping', { timestamp: Date.now() });
      return true;
    }
    return false;
  }

  // 处理断开连接
  private handleDisconnect(reason: string) {
    console.log('处理断开连接，原因:', reason);
    
    // 如果是主动断开，不重连
    if (reason === 'io client disconnect') {
      return;
    }
    
    // 开始重连
    this.startReconnect();
  }

  // 处理连接错误
  private handleConnectError(error: any) {
    console.error('处理连接错误:', error);
    
    // 如果重连次数过多，暂停重连
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ 已达到最大重连次数(${this.maxReconnectAttempts})，停止重连`);
      this.isReconnecting = false;
      return;
    }
    
    // 开始重连
    this.startReconnect();
  }

  // 开始重连
  private startReconnect() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('重连次数已达上限或正在重连中，停止重连');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    // 指数退避（最大 30s）
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`开始第 ${this.reconnectAttempts} 次重连，延迟 ${delay}ms`);
    
    setTimeout(() => {
      if (this.token) {
        console.log('执行重连...');
        this.connect(this.token);
      }
    }, delay);
  }

  // 重新加入房间
  private rejoinRooms() {
    console.log('重新加入房间:', Array.from(this.currentRooms));
    
    // 重新登录
    if (this.userType === 'user' && this.userId) {
      this.userLogin(this.token!);
    } else if (this.userType === 'customer_service' && this.userId) {
      this.customerServiceLogin(this.token!);
    }
    
    // 重新加入会话房间
    this.currentRooms.forEach(room => {
      if (room.startsWith('session_')) {
        console.log('重新加入会话房间:', room);
        this.socket?.emit('join_session', { sessionId: room.replace('session_', '') });
      }
    });
  }

  // 加入房间
  joinRoom(room: string) {
    this.currentRooms.add(room);
    console.log('加入房间:', room);
    if (this.socket) {
      this.socket.emit('join_session', { sessionId: room.replace('session_', '') });
    }
  }

  // 离开房间
  leaveRoom(room: string) {
    this.currentRooms.delete(room);
    console.log('离开房间:', room);
  }

  // 设置用户信息
  setUserInfo(userType: 'user' | 'customer_service', userId: number) {
    this.userType = userType;
    this.userId = userId;
  }

  // 获取当前房间列表
  getCurrentRooms() {
    return Array.from(this.currentRooms);
  }

  // 强制重连
  forceReconnect() {
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    if (this.token) {
      this.connect(this.token);
    }
  }
}

const socketService = new SocketService();
export default socketService;

// 客服信息
export interface CustomerService {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'busy';
  max_concurrent_chats: number;
  current_chats: number;
  created_at: string;
  last_login_at?: string;
}

// 聊天会话
export interface ChatSession {
  id: number;
  session_id: string;
  customer_service_id?: number;
  user_id?: number;
  visitor_id?: string;
  visitor_name?: string;
  visitor_email?: string;
  status: 'waiting' | 'active' | 'ended' | 'transferred';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags?: any;
  notes?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

// 聊天消息
export interface ChatMessage {
  id: number;
  session_id: string;
  sender_type: 'customer_service' | 'user' | 'visitor' | 'system';
  sender_id?: number;
  sender_name: string;
  message_type: 'text' | 'image' | 'file' | 'emoji' | 'system';
  content?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

// 文件信息
export interface FileData {
  id?: number;
  originalName: string;
  filename: string;
  filePath: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  fileType: 'image' | 'document' | 'video' | 'audio' | 'other';
  thumbnailPath?: string;
  thumbnailUrl?: string;
}

// API响应
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  error?: string;
}

// 登录响应
export interface LoginResponse {
  token: string;
  customerService: CustomerService;
}

// 统计信息
export interface ChatStatistics {
  totalSessions: number;
  activeSessions: number;
  endedSessions: number;
  totalMessages: number;
  todaySessions: number;
  todayMessages: number;
}

// Socket.IO事件类型
export interface SocketEvents {
  // 连接事件
  connect: () => void;
  disconnect: () => void;
  connect_error: (error: Error) => void;

  // 登录事件
  login_success: (data: { message: string; customerServiceId: number }) => void;
  login_error: (data: { message: string; error: string }) => void;

  // 会话事件
  session_accepted: (data: { sessionId: string; customerServiceId: number; message: string }) => void;
  session_taken: (data: { sessionId: string; customerServiceId: number }) => void;
  new_waiting_user: (data: {
    sessionId: string;
    userId?: number;
    visitorId?: string;
    visitorName?: string;
    priority: string;
  }) => void;

  // 消息事件
  new_message: (data: {
    id: number;
    sessionId: string;
    senderType: string;
    senderId?: number;
    senderName: string;
    messageType: string;
    content?: string;
    fileData?: FileData;
    timestamp: string;
  }) => void;
  message_read: (data: { messageId: number }) => void;
  history_messages: (data: {
    sessionId: string;
    messages: ChatMessage[];
    page: number;
    hasMore: boolean;
  }) => void;

  // 用户事件
  user_connected: (data: {
    sessionId: string;
    userId?: number;
    visitorId?: string;
    visitorName?: string;
  }) => void;
  user_disconnected: (data: { sessionId: string }) => void;

  // 客服事件
  customer_service_online: (data: { customerServiceId: number; username: string }) => void;
  customer_service_offline: (data: { customerServiceId: number }) => void;
  customer_service_status_update: (data: { customerServiceId: number; status: string }) => void;

  // 状态事件
  status_updated: (data: { status: string }) => void;

  // 错误事件
  error: (data: { message: string; error?: string }) => void;
}

import axios from 'axios';
import { CustomerService, ChatSession, ChatMessage, FileData, ApiResponse } from '../types';

// Use REACT_APP_API_BASE_URL when provided (for production builds).
// Keep default empty so that in development (`npm start`) the CRA dev-server proxy
// (`src/setupProxy.js`) will handle requests to `/api`.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? '';

// Runtime fallback: 
// - If API_BASE_URL is set, use it
// - If not set and running on localhost (localhost/127.0.0.1), use http://localhost:7001
// - Otherwise (production), use empty string (relative path) to use Nginx proxy
const runtimeBase = (() => {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:7001';
    }
  }
  return ''; // 使用相对路径，通过 Nginx 代理
})();

// 调试日志（生产环境也会输出）
if (typeof window !== 'undefined') {
  console.log('🔧 API 配置:', {
    REACT_APP_API_BASE_URL: API_BASE_URL || '未设置',
    hostname: window.location.hostname,
    origin: window.location.origin,
    runtimeBase: runtimeBase || '(相对路径，通过 Nginx 代理)',
    NODE_ENV: process.env.NODE_ENV
  });
}

// 创建axios实例
const api = axios.create({
  baseURL: runtimeBase,
  timeout: 10000,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('customerServiceToken') || localStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    // 直接返回响应数据，保持原有的结构
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('customerServiceToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 普通用户认证API
export const userAPI = {
  // 登录
  login: (data: { username: string; password: string }) =>
    api.post<ApiResponse<{ token: string; user: any }>>('/api/v1/users/login', data),

  // 注册
  register: (data: {
    username: string;
    email: string;
    password: string;
    realName?: string;
  }) => api.post('/api/v1/users/register', data),

  // 获取个人信息
  getProfile: () => api.get<ApiResponse<any>>('/api/v1/users/profile'),

  // 获取历史会话
  getHistorySessions: () => api.get<ApiResponse<{ list: any[]; total: number }>>('/api/v1/users/sessions'),

  // 获取会话消息
  getMessages: (sessionId: string) => api.get<ApiResponse<any[]>>(`/api/v1/chat/messages/${sessionId}`),

  // 获取所有客服列表
  getAllCustomerServices: () => api.get<ApiResponse<any[]>>('/api/v1/users/customer-services'),

  // 获取用户信息
  getUserInfo: (userId: number) => api.get<ApiResponse<any>>(`/api/v1/users/info/${userId}`),

  // 更新个人信息
  updateProfile: (data: {
    realName?: string;
    avatar?: string;
  }) => api.put<ApiResponse<any>>('/api/v1/users/profile', data),
};

// 客服认证API
export const customerServiceAPI = {
  // 注册
  register: (data: {
    username: string;
    email: string;
    password: string;
    realName?: string;
  }) => api.post('/api/v1/customer-service/register', data),

  // 登录
  login: (data: { username: string; password: string }) => (async () => {
    const response = await api.post<ApiResponse<{ token: string; customerService: CustomerService }>>('/api/v1/customer-service/login', data);
    return response && response.data;
  })(),

  // 获取个人信息
  getProfile: () => api.get<ApiResponse<CustomerService>>('/api/v1/customer-service/profile'),

  // 更新个人信息
  updateProfile: (data: {
    realName?: string;
    avatar?: string;
    maxConcurrentChats?: number;
  }) => api.put<ApiResponse<CustomerService>>('/api/v1/customer-service/profile', data),

  // 获取在线客服列表
  getOnlineList: () => api.get<ApiResponse<CustomerService[]>>('/api/v1/customer-service/online'),

  // 获取等待中的会话
  getWaitingSessions: () => api.get<ApiResponse<{ list: ChatSession[]; total: number }>>('/api/v1/customer-service/waiting-sessions'),

  // 上传头像
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post<ApiResponse<{ avatar: string }>>('/api/v1/customer-service/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getMessages: (sessionId: string) => api.get<ApiResponse<{ list: ChatMessage[] }>>(`/api/v1/chat/sessions/${sessionId}/messages`),
};

// 聊天API
export const chatAPI = {
  // 获取会话列表
  getSessions: () => api.get<ApiResponse<{ list: ChatSession[] }>>('/api/v1/chat/sessions'),

  // 获取会话详情
  getSessionDetail: (sessionId: string) =>
    api.get<ApiResponse<ChatSession>>(`/api/v1/chat/sessions/${sessionId}`),

  // 获取会话消息（支持 onlyToday 过滤）
  getSessionMessages: (sessionId: string, page = 1, pageSize = 50, onlyToday?: boolean) =>
    api.get<ApiResponse<{ list: ChatMessage[] }>>(`/api/v1/chat/sessions/${sessionId}/messages`, {
      params: { page, pageSize, onlyToday: onlyToday ? 1 : 0 },
    }),

  // 获取会话消息（简化版本）
  getMessages: (sessionId: string) => api.get<ApiResponse<ChatMessage[]>>(`/api/v1/chat/messages/${sessionId}`),

  // 结束会话
  endSession: (sessionId: string, notes?: string) =>
    api.post<ApiResponse>(`/api/v1/chat/sessions/${sessionId}/end`, { notes }),

  // 转移会话
  transferSession: (sessionId: string, targetCustomerServiceId: number, reason?: string) =>
    api.post<ApiResponse>(`/api/v1/chat/sessions/${sessionId}/transfer`, {
      targetCustomerServiceId,
      reason,
    }),

  // 获取聊天统计
  getStatistics: () => api.get<ApiResponse<{ totalSessions: number; activeSessions: number; endedSessions: number; totalMessages: number; todaySessions: number; todayMessages: number }>>('/api/v1/chat/statistics'),

  // 上传聊天文件
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<FileData>>('/api/v1/chat/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default api;

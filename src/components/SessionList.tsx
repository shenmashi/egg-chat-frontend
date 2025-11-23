import React, { useState, useEffect } from 'react';
import {
  List,
  Avatar,
  Typography,
  Badge,
  Tag,
  Space,
  Button,
  Tooltip,
  Card
} from 'antd';
import {
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  MessageOutlined,
  MailOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ChatSession } from '../types';
import { chatAPI, customerServiceAPI } from '../services/api';
import socketService from '../services/socket';

// 添加CSS动画样式
const pulseAnimation = `
  @keyframes pulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
  }
`;

// 注入样式
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = pulseAnimation;
  document.head.appendChild(style);
}

const { Text } = Typography;

interface SessionListProps {
  currentSession: ChatSession | null;
  onSessionSelect: (session: ChatSession) => void;
  onAcceptSession: (sessionId: string) => void;
}

const SessionList: React.FC<SessionListProps> = ({
  currentSession,
  onSessionSelect,
  onAcceptSession
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [waitingSessions, setWaitingSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载会话列表
  const loadSessions = async () => {
    setLoading(true);
    try {
      const [sessionsResponse, waitingResponse] = await Promise.all([
        chatAPI.getSessions(),
        customerServiceAPI.getWaitingSessions()
      ]);

      // 工具：按用户去重，仅保留每个用户最新的一条会话
      const dedupeByUserLatest = (items: ChatSession[] = []) => {
        const latestByUser = new Map<string | number, ChatSession>();
        for (const item of items) {
          const key = (item.user_id ?? item.visitor_id) as string | number;
          if (key === undefined || key === null) continue;
          const existing = latestByUser.get(key);
          if (!existing) {
            latestByUser.set(key, item);
          } else {
            const tsA = dayjs(item.created_at).valueOf();
            const tsB = dayjs(existing.created_at).valueOf();
            if (tsA > tsB) latestByUser.set(key, item);
          }
        }
        // 返回按时间倒序
        return Array.from(latestByUser.values()).sort((a, b) =>
          dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
        );
      };

      if (sessionsResponse.data.code === 200) {
        const list = sessionsResponse.data.data?.list || [];
        setSessions(dedupeByUserLatest(list));
      }

      if (waitingResponse.data.code === 200) {
        const list = waitingResponse.data.data?.list || [];
        setWaitingSessions(dedupeByUserLatest(list));
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // 监听Socket.IO事件
  useEffect(() => {
    // 新等待用户
    socketService.on('new_waiting_user', (data) => {
      loadSessions(); // 重新加载列表
    });

    // 会话被接受
    socketService.on('session_accepted', (data) => {
      loadSessions(); // 重新加载列表
    });

    // 会话被转移
    socketService.on('session_taken', (data) => {
      loadSessions(); // 重新加载列表
    });

    // 用户取消等待
    socketService.on('session_cancelled', (data) => {
      loadSessions(); // 重新加载列表
    });

    return () => {
      socketService.off('new_waiting_user');
      socketService.off('session_accepted');
      socketService.off('session_taken');
      socketService.off('session_cancelled');
    };
  }, []);

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig = {
      waiting: { color: 'orange', text: '等待中', icon: <ClockCircleOutlined /> },
      active: { color: 'green', text: '进行中', icon: <CheckCircleOutlined /> },
      ended: { color: 'red', text: '已结束', icon: <ExclamationCircleOutlined /> },
      transferred: { color: 'blue', text: '已转移', icon: <ExclamationCircleOutlined /> },
      cancelled: { color: 'gray', text: '已取消', icon: <ExclamationCircleOutlined /> }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 获取优先级标签
  const getPriorityTag = (priority: string) => {
    const priorityConfig = {
      low: { color: 'default', text: '低' },
      normal: { color: 'blue', text: '普通' },
      high: { color: 'orange', text: '高' },
      urgent: { color: 'red', text: '紧急' }
    };
    
    const config = priorityConfig[priority as keyof typeof priorityConfig];
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  // 渲染会话项
  const renderSessionItem = (session: ChatSession) => {
    const isActive = currentSession?.session_id === session.session_id;
    const userName = session.visitor_name || `用户${session.user_id || session.visitor_id}`;
    const isWaiting = session.status === 'waiting';
    
    return (
      <div
        key={session.session_id}
        style={{
          padding: '16px',
          cursor: 'pointer',
          background: isActive ? '#e6f7ff' : isWaiting ? '#fff2f0' : '#fafafa',
          borderLeft: isActive ? '4px solid #1890ff' : isWaiting ? '4px solid #ff4d4f' : '4px solid transparent',
          borderRadius: '12px',
          margin: '8px 0',
          border: isActive ? '1px solid #91d5ff' : isWaiting ? '1px solid #ffccc7' : '1px solid #f0f0f0',
          transition: 'all 0.3s ease',
          boxShadow: isActive ? '0 4px 12px rgba(24, 144, 255, 0.15)' : isWaiting ? '0 4px 12px rgba(255, 77, 79, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}
        onClick={() => onSessionSelect(session)}
      >
        {/* 背景装饰 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '60px',
            height: '60px',
            background: isWaiting ? 'linear-gradient(135deg, #ff4d4f20, #ff787520)' : isActive ? 'linear-gradient(135deg, #1890ff20, #40a9ff20)' : 'linear-gradient(135deg, #f0f0f020, #d9d9d920)',
            borderRadius: '0 12px 0 60px',
            zIndex: 0
          }}
        />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* 头部信息 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge
                dot={isWaiting}
                color={isWaiting ? '#ff4d4f' : undefined}
                offset={[-2, 2]}
              >
                <Avatar
                  size={48}
                  icon={<UserOutlined />}
                  style={{
                    background: isWaiting ? '#ff4d4f' : isActive ? '#1890ff' : '#52c41a',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                  }}
                />
              </Badge>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Text strong style={{ fontSize: '16px', color: isWaiting ? '#ff4d4f' : isActive ? '#1890ff' : '#000' }}>
                    {userName}
                  </Text>
                  {isWaiting && (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#ff4d4f',
                      animation: 'pulse 2s infinite'
                    }} />
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getPriorityTag(session.priority)}
                  {getStatusTag(session.status)}
                </div>
              </div>
            </div>
            
            {/* 操作按钮 */}
            <div>
              {isWaiting ? (
                <Button
                  type="primary"
                  size="small"
                  style={{ 
                    borderRadius: '20px',
                    background: '#ff4d4f',
                    borderColor: '#ff4d4f',
                    boxShadow: '0 2px 4px rgba(255, 77, 79, 0.3)',
                    fontWeight: 500
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('点击接受会话:', session.session_id);
                    onAcceptSession(session.session_id);
                    // 立即选择会话，确保聊天界面打开
                    onSessionSelect(session);
                  }}
                >
                  立即接受
                </Button>
              ) : isActive ? (
                <Button
                  type="link"
                  size="small"
                  style={{ 
                    color: '#52c41a',
                    fontWeight: 500,
                    padding: '4px 12px',
                    borderRadius: '16px',
                    background: '#f6ffed',
                    border: '1px solid #b7eb8f'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSessionSelect(session);
                  }}
                >
                  进入聊天
                </Button>
              ) : null}
            </div>
          </div>
          
          {/* 底部信息 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {session.visitor_email && (
                <Tooltip title={session.visitor_email}>
                  <MailOutlined style={{ fontSize: '14px', color: '#999' }} />
                </Tooltip>
              )}
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {dayjs(session.created_at).format('MM-DD HH:mm')}
              </Text>
              {isWaiting && (
                <Text type="secondary" style={{ fontSize: '12px', color: '#ff4d4f' }}>
                  等待 {dayjs().diff(dayjs(session.created_at), 'minute')} 分钟
                </Text>
              )}
            </div>
            {session.notes && (
              <Text type="secondary" style={{ fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session.notes}
              </Text>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 等待中的会话 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <MessageOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>等待中的会话</span>
              {waitingSessions.length > 0 && (
                <Badge 
                  count={waitingSessions.length} 
                  style={{ 
                    backgroundColor: '#ff4d4f',
                    fontSize: '11px',
                    minWidth: '18px',
                    height: '18px',
                    lineHeight: '18px'
                  }} 
                />
              )}
            </Space>
            {waitingSessions.length > 0 && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                共 {waitingSessions.length} 个等待接入
              </Text>
            )}
          </div>
        }
        size="small"
        style={{ 
          borderRadius: '12px',
          border: waitingSessions.length > 0 ? '1px solid #ff4d4f' : '1px solid #f0f0f0',
          boxShadow: waitingSessions.length > 0 ? '0 2px 8px rgba(255, 77, 79, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}
        bodyStyle={{ 
          padding: waitingSessions.length > 0 ? '16px' : '24px',
          borderRadius: '12px',
          minHeight: waitingSessions.length > 0 ? 'auto' : '120px',
          display: 'flex',
          alignItems: waitingSessions.length > 0 ? 'stretch' : 'center',
          justifyContent: waitingSessions.length > 0 ? 'stretch' : 'center'
        }}
      >
        {waitingSessions.length > 0 ? (
          <List
            dataSource={waitingSessions}
            renderItem={renderSessionItem}
            size="small"
            style={{ width: '100%' }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#999' }}>
            <MessageOutlined style={{ fontSize: '32px', marginBottom: '8px' }} />
            <div>暂无等待中的会话</div>
          </div>
        )}
      </Card>

      {/* 我的会话 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <UserOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>我的会话</span>
              {sessions.length > 0 && (
                <Badge 
                  count={sessions.length} 
                  style={{ 
                    backgroundColor: '#52c41a',
                    fontSize: '11px',
                    minWidth: '18px',
                    height: '18px',
                    lineHeight: '18px'
                  }} 
                />
              )}
            </Space>
            {sessions.length > 0 && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                共 {sessions.length} 个进行中
              </Text>
            )}
          </div>
        }
        size="small"
        style={{ 
          flex: 1,
          borderRadius: '12px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}
        bodyStyle={{ 
          padding: '16px', 
          height: 'calc(100vh - 280px)', 
          overflow: 'auto',
          borderRadius: '12px'
        }}
      >
        <List
          dataSource={sessions}
          renderItem={renderSessionItem}
          size="small"
          loading={loading}
          style={{ width: '100%' }}
          locale={{ 
            emptyText: (
              <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
                <UserOutlined style={{ fontSize: '32px', marginBottom: '8px' }} />
                <div>暂无会话</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>接受等待中的会话开始工作</div>
              </div>
            )
          }}
        />
      </Card>
    </div>
  );
};

export default SessionList;

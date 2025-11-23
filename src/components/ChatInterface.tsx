import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layout,
  Input,
  Button,
  List,
  Avatar,
  Typography,
  Space,
  Dropdown,
  Menu,
  message,
  Upload,
  Modal,
  Tag,
  Tooltip
} from 'antd';
import {
  SendOutlined,
  PaperClipOutlined,
  SmileOutlined,
  MoreOutlined,
  UserOutlined,
  MailOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  MessageOutlined
} from '@ant-design/icons';
import EmojiPicker from 'emoji-picker-react';
import dayjs from 'dayjs';
import { ChatSession, ChatMessage } from '../types';
import { chatAPI, userAPI } from '../services/api';
import socketService from '../services/socket';
import { getImageUrl, getFileUrl } from '../utils/url';

const { Header, Content } = Layout;
const { TextArea } = Input;
const { Title } = Typography;

interface ChatInterfaceProps {
  currentSession: ChatSession | null;
  onSessionChange: (session: ChatSession | null) => void;
  userType?: 'user' | 'customer_service'; // 添加用户类型标识
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  currentSession,
  onSessionChange,
  userType = 'customer_service' // 默认为客服端
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [emojiVisible, setEmojiVisible] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 获取用户信息
  const fetchUserInfo = useCallback(async (userId: number) => {
    try {
      const response = await userAPI.getUserInfo(userId);
      if (response.data.code === 200) {
        setUserInfo(response.data.data);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 当会话变化时获取用户信息
  useEffect(() => {
    if (currentSession?.user_id) {
      const userId = currentSession.user_id;
      if (userId) {
        fetchUserInfo(userId);
      }
    }
  }, [currentSession, fetchUserInfo]);

  const loadHistory = useCallback(async () => {
    if (!currentSession) return;
    
    try {
      const response = await chatAPI.getSessionMessages(currentSession.session_id);
      if (response.data.code === 200) {
        setMessages(response.data.data?.list || []);
      }
    } catch (error) {
      message.error('加载历史消息失败');
    }
  }, [currentSession]);

  // 加载历史消息
  useEffect(() => {
    if (currentSession) {
      loadHistory();
    }
  }, [currentSession, loadHistory]);

  // 监听新消息
  useEffect(() => {
    const handleNewMessage = (data: any) => {
      console.log('ChatInterface收到新消息:', data);
      console.log('消息类型:', data.messageType);
      console.log('文件数据:', data.fileData);
      
      if (data.sessionId === currentSession?.session_id) {
        const newMessage: ChatMessage = {
          id: data.id,
          session_id: data.sessionId,
          sender_type: data.senderType,
          sender_id: data.senderId,
          sender_name: data.senderName,
          message_type: data.messageType,
          content: data.content,
          file_url: data.fileData?.url,
          file_name: data.fileData?.name,
          file_size: data.fileData?.size,
          is_read: false,
          created_at: data.timestamp,
          updated_at: data.timestamp
        };
        
        console.log('构建的新消息:', newMessage);
        setMessages(prev => [...prev, newMessage]);
      }
    };

    // 监听会话结束事件
    const handleSessionEnded = (data: any) => {
      console.log('ChatInterface收到会话结束事件:', data);
      if (data.sessionId === currentSession?.session_id) {
        const endedBy = data.endedBy?.type === 'customer_service' ? '客服' : '用户';
        message.warning(`会话已由${endedBy}结束`);
        // 关闭当前会话
        onSessionChange(null);
      }
    };

    // 先移除可能存在的其他监听器，避免重复监听
    socketService.off('new_message');
    socketService.off('session_ended');
    socketService.on('new_message', handleNewMessage);
    socketService.on('session_ended', handleSessionEnded);

    return () => {
      socketService.off('new_message', handleNewMessage);
      socketService.off('session_ended', handleSessionEnded);
    };
  }, [currentSession, onSessionChange]);

  // 发送消息
  const sendMessage = async () => {
    if (!inputValue.trim() || !currentSession) return;

    const messageData = {
      sessionId: currentSession.session_id,
      content: inputValue.trim(),
      messageType: 'text' as const
    };

    // 立即添加到本地消息列表
    const newMessage: ChatMessage = {
      id: Date.now(),
      session_id: currentSession.session_id,
      sender_type: userType,
      sender_id: userType === 'user' ? (currentSession as any).user_id || (currentSession as any).userId || 0 : 0,
      sender_name: userType === 'user' ? '我' : '客服',
      message_type: 'text',
      content: inputValue.trim(),
      file_url: undefined,
      file_name: undefined,
      file_size: undefined,
      is_read: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputValue('');

    socketService.sendMessage(messageData);
  };

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 选择表情
  const onEmojiClick = (emojiData: any) => {
    setInputValue(prev => prev + emojiData.emoji);
    setEmojiVisible(false);
  };

  // 上传文件
  const handleFileUpload = async (file: File) => {
    try {
      const response = await chatAPI.uploadFile(file);
      if (response.data.code === 200) {
        const fileData = response.data.data;
        
        if (fileData) {
          // 立即添加到本地消息列表
          const newMessage: ChatMessage = {
            id: Date.now(),
            session_id: currentSession!.session_id,
            sender_type: userType,
            sender_id: userType === 'user' ? (currentSession as any).user_id || (currentSession as any).userId || 0 : 0,
            sender_name: userType === 'user' ? '我' : '客服',
            message_type: fileData.fileType === 'image' ? 'image' : 'file',
            content: fileData.fileType === 'image' ? '[图片]' : `[文件] ${fileData.originalName}`,
            file_url: fileData.fileUrl,
            file_name: fileData.originalName,
            file_size: fileData.fileSize,
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          setMessages(prev => [...prev, newMessage]);
          
          // 发送消息到服务器
          const messageData = {
            sessionId: currentSession!.session_id,
            content: fileData.fileType === 'image' ? '[图片]' : `[文件] ${fileData.originalName}`,
            messageType: (fileData.fileType === 'image' ? 'image' : 'file') as 'image' | 'file',
            fileData: {
              url: fileData.fileUrl,
              name: fileData.originalName,
              size: fileData.fileSize,
              type: fileData.fileType
            }
          };

          socketService.sendMessage(messageData);
          setUploadVisible(false);
          message.success('文件上传成功');
        }
      }
    } catch (error) {
      message.error('文件上传失败');
    }
  };

  // 结束会话
  const endSession = async () => {
    if (!currentSession) return;

    Modal.confirm({
      title: '结束会话',
      content: '确定要结束当前会话吗？',
      onOk: async () => {
        try {
          await chatAPI.endSession(currentSession.session_id);
          message.success('会话已结束');
          onSessionChange(null);
        } catch (error) {
          message.error('结束会话失败');
        }
      }
    });
  };

  // 会话菜单
  const sessionMenu = (
    <Menu>
      <Menu.Item key="end" onClick={endSession}>
        结束会话
      </Menu.Item>
    </Menu>
  );

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig = {
      waiting: { color: 'orange', text: '等待中', icon: <ClockCircleOutlined /> },
      active: { color: 'green', text: '进行中', icon: <CheckCircleOutlined /> },
      ended: { color: 'red', text: '已结束', icon: <ExclamationCircleOutlined /> },
      transferred: { color: 'blue', text: '已转移', icon: <ExclamationCircleOutlined /> }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: '未知', icon: null };
    return (
      <Tag 
        color={config.color} 
        icon={config.icon}
        style={{ 
          fontSize: '11px', 
          lineHeight: '16px',
          height: '18px',
          padding: '0 6px',
          margin: 0
        }}
      >
        {config.text}
      </Tag>
    );
  };

  // 渲染消息
  const renderMessage = (message: ChatMessage) => {
    // 根据当前用户类型判断消息是否为自己发送的
    const isOwnMessage = (userType === 'user' && message.sender_type === 'user') || 
                        (userType === 'customer_service' && message.sender_type === 'customer_service');
    const isSystem = message.sender_type === 'system';
    
    console.log('渲染消息:', {
      id: message.id,
      message_type: message.message_type,
      file_url: message.file_url,
      content: message.content,
      isOwnMessage
    });
    
    // 系统消息居中显示
    if (isSystem) {
      return (
        <div
          key={message.id}
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '16px'
          }}
        >
          <div
            style={{
              background: '#e6f7ff',
              color: '#1890ff',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              border: '1px solid #91d5ff',
              textAlign: 'center',
              maxWidth: '80%'
            }}
          >
            {message.content}
          </div>
        </div>
      );
    }
    
    return (
      <div
        key={message.id}
        style={{
          display: 'flex',
          justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
          marginBottom: '16px'
        }}
      >
        <div
          style={{
            maxWidth: '70%',
            background: isOwnMessage ? '#1890ff' : '#f0f0f0',
            color: isOwnMessage ? 'white' : 'black',
            padding: '12px 16px',
            borderRadius: '12px',
            wordBreak: 'break-word'
          }}
        >
          {!isOwnMessage && (
            <div style={{ marginBottom: '4px', fontSize: '12px', opacity: 0.7 }}>
              {message.sender_name}
            </div>
          )}
          
          {message.message_type === 'text' && (
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
          )}
          
          {message.message_type === 'image' && (
            <div>
              <img
                src={getImageUrl(message.file_url)}
                alt="图片"
                style={{
                  maxWidth: '200px',
                  maxHeight: '200px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  Modal.info({
                    title: '图片预览',
                    content: (
                      <img
                        src={getImageUrl(message.file_url)}
                        alt="图片"
                        style={{ width: '100%', maxHeight: '500px', objectFit: 'contain' }}
                      />
                    ),
                    width: 'auto'
                  });
                }}
              />
            </div>
          )}
          
          {message.message_type === 'file' && (
            <div>
              <PaperClipOutlined style={{ marginRight: '8px' }} />
              <a href={getFileUrl(message.file_url)} target="_blank" rel="noopener noreferrer">
                {message.file_name}
              </a>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                {(message.file_size! / 1024).toFixed(1)} KB
              </div>
            </div>
          )}
          
          <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
            {dayjs(message.created_at).format('HH:mm')}
          </div>
        </div>
      </div>
    );
  };

  if (!currentSession) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        flexDirection: 'column'
      }}>
        <div style={{ 
          textAlign: 'center',
          padding: '40px',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px'
        }}>
          <MessageOutlined style={{ fontSize: '64px', color: '#1890ff', marginBottom: '16px' }} />
          <Title level={3} style={{ color: '#1890ff', marginBottom: '8px' }}>欢迎使用客服系统</Title>
          <Title level={5} type="secondary" style={{ margin: 0 }}>选择一个会话开始聊天</Title>
        </div>
      </div>
    );
  }

  // 如果会话状态是waiting，显示等待界面
  if (currentSession.status === 'waiting') {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
        flexDirection: 'column'
      }}>
        <div style={{ 
          textAlign: 'center',
          padding: '40px',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px'
        }}>
          <ClockCircleOutlined style={{ fontSize: '64px', color: '#fa8c16', marginBottom: '16px' }} />
          <Title level={3} style={{ color: '#fa8c16', marginBottom: '8px' }}>正在建立连接</Title>
          <Title level={5} type="secondary" style={{ margin: 0 }}>请稍候，正在与用户建立连接...</Title>
          <div style={{ marginTop: '16px', padding: '12px', background: '#fff7e6', borderRadius: '8px', border: '1px solid #ffd591' }}>
            <span style={{ fontSize: '12px', color: '#666' }}>
              会话ID: {currentSession.session_id}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 会话头部 */}
      <Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '60px',
          flexShrink: 0,
          minHeight: '60px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <Avatar
            size={40}
            src={getImageUrl(userInfo?.avatar)}
            icon={<UserOutlined />}
            style={{ marginRight: '12px', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ 
              fontWeight: 'bold', 
              fontSize: '16px',
              lineHeight: '20px',
              marginBottom: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {userType === 'user' 
                ? ((currentSession as any).customerServiceName || (currentSession as any).customer_service_name || `客服${(currentSession as any).customerServiceId || (currentSession as any).customer_service_id || ''}`)
                : (userInfo?.username || (currentSession as any).username || currentSession.visitor_name || `用户${currentSession.user_id}`)
              }
            </div>
            <div style={{ fontSize: '12px', color: '#666', lineHeight: '16px' }}>
              {getStatusTag(currentSession.status)}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Space size="small">
            {(userInfo?.email || currentSession.visitor_email) && (
              <Tooltip title={userInfo?.email || currentSession.visitor_email}>
                <MailOutlined style={{ fontSize: '16px', color: '#666' }} />
              </Tooltip>
            )}
            <Dropdown overlay={sessionMenu} trigger={['click']}>
              <Button type="text" icon={<MoreOutlined />} size="small" />
            </Dropdown>
          </Space>
        </div>
      </Header>

      {/* 消息列表 */}
      <Content
        style={{
          flex: 1,
          padding: '16px 20px',
          overflow: 'auto',
          background: '#fafafa',
          minHeight: 0
        }}
      >
        <List
          dataSource={messages}
          renderItem={renderMessage}
          locale={{ emptyText: '暂无消息' }}
        />
        <div ref={messagesEndRef} />
      </Content>

      {/* 输入区域 */}
      <div
        style={{
          padding: '12px 16px',
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          flexShrink: 0
        }}
      >
        <Space.Compact style={{ width: '100%' }}>
          <Button
            icon={<PaperClipOutlined />}
            onClick={() => setUploadVisible(true)}
            style={{ borderRadius: '6px 0 0 6px' }}
          />
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ borderRadius: 0 }}
          />
          <Button
            icon={<SmileOutlined />}
            onClick={() => setEmojiVisible(!emojiVisible)}
            style={{ borderRadius: 0 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={sendMessage}
            loading={false}
            style={{ borderRadius: '0 6px 6px 0' }}
          />
        </Space.Compact>

        {/* 表情选择器 */}
        {emojiVisible && (
          <div style={{ position: 'absolute', bottom: '80px', right: '24px', zIndex: 1000 }}>
            <EmojiPicker onEmojiClick={onEmojiClick} />
          </div>
        )}
      </div>

      {/* 文件上传模态框 */}
      <Modal
        title="上传文件"
        open={uploadVisible}
        onCancel={() => setUploadVisible(false)}
        footer={null}
      >
        <Upload.Dragger
          beforeUpload={(file) => {
            handleFileUpload(file);
            return false;
          }}
          showUploadList={false}
          accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
        >
          <p className="ant-upload-drag-icon">
            <PaperClipOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持图片、文档、压缩包等格式，最大10MB
          </p>
        </Upload.Dragger>
      </Modal>
    </div>
  );
};

export default ChatInterface;

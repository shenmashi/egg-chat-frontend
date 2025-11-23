import React from 'react';
import { Spin } from 'antd';

interface LoadingProps {
  fullscreen?: boolean;
  tip?: string;
  height?: number | string;
}

const Loading: React.FC<LoadingProps> = ({ fullscreen = true, tip = '加载中...', height }) => {
  const style: React.CSSProperties = fullscreen
    ? { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.6)', zIndex: 9999 }
    : { display: 'flex', alignItems: 'center', justifyContent: 'center', height: height ?? 200 };

  return (
    <div style={style}>
      <Spin size="large" tip={tip} />
    </div>
  );
};

export default Loading;


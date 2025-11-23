import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import './i18n/config';

// 引入 vconsole 用于移动端调试
// import VConsole from 'vconsole';

// 初始化 vconsole（生产环境可以通过环境变量控制是否启用）
if (process.env.NODE_ENV !== 'production' || process.env.REACT_APP_ENABLE_VCONSOLE === 'true') {
  // const vConsole = new VConsole({
  //   theme: 'dark', // 主题颜色: 'dark' | 'light'
  //   maxLogNumber: 1000, // 最大日志条数
  //   defaultPlugins: ['system', 'network', 'element', 'storage'],
  //   onReady: function () {
  //     console.log('VConsole 已初始化');
  //   },
  //   onClearLog: function () {
  //     console.log('VConsole 日志已清空');
  //   }
  // });
  
  // 全局暴露 vConsole 实例，方便手动控制
  // (window as any).vConsole = vConsole;
  
  // console.log('=== VConsole 调试工具已启用 ===');
  // console.log('Socket连接URL:', process.env.REACT_APP_SOCKET_URL || 'auto-detect');
  // console.log('当前环境:', process.env.NODE_ENV);
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

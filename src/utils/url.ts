/**
 * URL 工具函数
 * 处理相对路径，转换为完整的 URL
 */

/**
 * 将相对路径转换为完整 URL
 * @param url 可能是相对路径或完整 URL
 * @returns 完整的 URL
 */
export const getFullUrl = (url: string | undefined | null): string => {
  if (!url) {
    return '';
  }

  // 如果已经是完整 URL（包含 http:// 或 https://），直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // 如果是相对路径（以 / 开头），加上当前域名
  if (url.startsWith('/')) {
    if (typeof window !== 'undefined') {
      if (window.location.origin.includes('localhost')) {
        return `http://localhost:7001${url}`;
      }
      return `${window.location.origin}${url}`;
    }
    // 如果不在浏览器环境，返回原路径
    return url;
  }

  // 其他情况（如 data: URL），直接返回
  return url;
};

/**
 * 处理图片 URL（用于 img src）
 * @param url 图片 URL
 * @returns 处理后的完整 URL
 */
export const getImageUrl = (url: string | undefined | null): string => {
  return getFullUrl(url);
};

/**
 * 处理文件 URL（用于下载链接）
 * @param url 文件 URL
 * @returns 处理后的完整 URL
 */
export const getFileUrl = (url: string | undefined | null): string => {
  return getFullUrl(url);
};


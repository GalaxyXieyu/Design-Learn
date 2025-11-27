/**
 * 路由扫描器
 * 自动发现网站的所有路由
 */
class RouteScanner {
  constructor() {
    this.baseUrl = new URL(window.location.href);
    this.routes = new Set();
  }
  
  /**
   * 添加路径到集合（统一处理去重）
   */
  addPath(path) {
    if (!path) return;
    
    // 移除末尾斜杠（除了根路径）
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    this.routes.add(path);
  }
  
  /**
   * 扫描当前页面的所有链接
   */
  async scanCurrentPage() {
    console.log('[RouteScanner] 开始扫描路由...');
    
    // 0. 添加当前页面
    this.addPath(this.baseUrl.pathname);
    
    // 1. 收集所有链接
    const links = document.querySelectorAll('a[href]');
    
    links.forEach(link => {
      try {
        const href = link.getAttribute('href');
        if (!href) return;
        
        // 解析 URL
        const url = new URL(href, this.baseUrl);
        
        // 只保留同域名的链接
        if (url.origin === this.baseUrl.origin) {
          this.addPath(url.pathname);
        }
      } catch (e) {
        // 忽略无效的 URL
      }
    });
    
    // 2. 扫描导航菜单
    this.scanNavigation();
    
    // 3. 扫描 sitemap（如果存在）
    await this.scanSitemap();
    
    const routeList = Array.from(this.routes).sort();
    console.log('[RouteScanner] 发现', routeList.length, '个路由');
    
    return routeList;
  }
  
  /**
   * 扫描导航菜单
   */
  scanNavigation() {
    // 常见的导航选择器
    const navSelectors = [
      'nav a[href]',
      'header a[href]',
      '[role="navigation"] a[href]',
      '.nav a[href]',
      '.navigation a[href]',
      '.menu a[href]',
      '.navbar a[href]'
    ];
    
    navSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(link => {
        try {
          const href = link.getAttribute('href');
          if (!href) return;
          
          const url = new URL(href, this.baseUrl);
          if (url.origin === this.baseUrl.origin) {
            this.addPath(url.pathname);
          }
        } catch (e) {}
      });
    });
  }
  
  /**
   * 尝试获取 sitemap
   */
  async scanSitemap() {
    const sitemapPaths = ['/sitemap.xml', '/wp-sitemap.xml', '/sitemap_index.xml'];
    
    for (const path of sitemapPaths) {
      try {
        const sitemapUrl = new URL(path, this.baseUrl);
        const response = await fetch(sitemapUrl.toString());
        
        if (response.ok) {
          console.log('[RouteScanner] 发现 sitemap:', path);
          const text = await response.text();
          const parser = new DOMParser();
          const xml = parser.parseFromString(text, 'text/xml');
          
          const urls = xml.querySelectorAll('url loc');
          urls.forEach(loc => {
            try {
              const url = new URL(loc.textContent);
              if (url.origin === this.baseUrl.origin) {
                this.addPath(url.pathname);
              }
            } catch (e) {}
          });
          
          // 如果找到了有效的 sitemap，就不再尝试其他的
          if (urls.length > 0) break;
        }
      } catch (e) {
        // Sitemap 不存在或无法访问，继续尝试下一个
        console.log('[RouteScanner] 无法访问 sitemap:', path);
      }
    }
  }
  
  /**
   * 智能分组路由
   */
  groupRoutes(routes) {
    const groups = {
      root: [],
      blog: [],
      docs: [],
      products: [],
      other: []
    };
    
    routes.forEach(route => {
      if (route === '/') {
        groups.root.push(route);
      } else if (route.includes('/blog')) {
        groups.blog.push(route);
      } else if (route.includes('/doc')) {
        groups.docs.push(route);
      } else if (route.includes('/product')) {
        groups.products.push(route);
      } else {
        groups.other.push(route);
      }
    });
    
    return groups;
  }
  
  /**
   * 按路由深度排序（从浅到深）
   */
  sortRoutesByDepth(routes) {
    return routes.sort((a, b) => {
      const depthA = a.split('/').filter(Boolean).length;
      const depthB = b.split('/').filter(Boolean).length;
      return depthA - depthB;
    });
  }

  /**
   * 过滤路由
   */
  filterRoutes(routes, options = {}) {
    const {
      excludePatterns = [],
      maxDepth = null,
      limit = null
    } = options;
    
    let filtered = routes.filter(route => {
      // 排除特定模式
      for (const pattern of excludePatterns) {
        if (route.includes(pattern)) return false;
      }
      
      // 限制深度
      if (maxDepth !== null) {
        const depth = route.split('/').filter(Boolean).length;
        if (depth > maxDepth) return false;
      }
      
      return true;
    });
    
    // 按深度排序（从浅到深）
    filtered = this.sortRoutesByDepth(filtered);
    
    // 限制数量
    if (limit !== null) {
      filtered = filtered.slice(0, limit);
    }
    
    return filtered;
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanRoutes') {
    const scanner = new RouteScanner();
    
    // 异步执行扫描
    (async () => {
      try {
        const routes = await scanner.scanCurrentPage();
        
        // 按深度排序并限制为最多10个
        const filteredRoutes = scanner.filterRoutes(routes, {
          limit: 10
        });
        
        const groups = scanner.groupRoutes(filteredRoutes);
        
        sendResponse({
          success: true,
          routes: filteredRoutes,
          groups,
          total: filteredRoutes.length,
          totalFound: routes.length
        });
      } catch (error) {
        console.error('[RouteScanner] 扫描失败:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    
    return true; // 保持消息通道开启以进行异步响应
  }
});

console.log('[RouteScanner] Route scanner loaded');

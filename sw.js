// 缓存版本：每次部署更新时递增此版本号，强制清理旧缓存
const CACHE_VERSION = 'v21';
const CACHE_NAME = `store-map-${CACHE_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 安装时缓存核心资源
self.addEventListener('install', event => {
  console.log('[SW] 新版本安装:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {
        console.log('[SW] 部分资源缓存失败');
      });
    })
  );
  self.skipWaiting();
});

// 激活时清理旧版本缓存
self.addEventListener('activate', event => {
  console.log('[SW] 新版本激活:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] 清理旧缓存:', k);
          return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

// 请求策略：HTML文件网络优先，其他资源缓存优先
self.addEventListener('fetch', event => {
  // 不缓存外部 API 请求
  if (event.request.url.includes('amap.com') || 
      event.request.url.includes('supabase.co') ||
      event.request.url.includes('webapi')) {
    return;
  }
  
  const url = new URL(event.request.url);
  const isHtml = event.request.headers.get('accept')?.includes('text/html') || 
                 url.pathname.endsWith('.html') || 
                 url.pathname === '/' || url.pathname.endsWith('/');
  
  if (isHtml) {
    // HTML文件：网络优先，确保总是获取最新版本
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        // 网络成功，更新缓存
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // 网络失败，返回缓存（离线模式）
        return caches.match(event.request);
      })
    );
  } else {
    // 静态资源：缓存优先，提升加载速度
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
  }
});

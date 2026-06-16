
// Tên của bộ nhớ đệm (Thay đổi phiên bản khi bạn cập nhật code: v2, v3...)
const CACHE_NAME = 'video-cutter-cache-v1';

// Danh sách các tài nguyên bạn muốn lưu cache để chạy Offline
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './coi-serviceworker.js',
    './favicon.png',
    // Thêm các file CSS, JS hoặc Icon khác của bạn ở đây (ví dụ: ./icon-512.png)
];

// 1. Sự kiện INSTALL: Kích hoạt khi Service Worker được cài đặt lần đầu
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Đang lưu cache các tài nguyên tĩnh');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting()) // Bỏ qua hàng chờ, kích hoạt ngay lập tức
    );
});

// 2. Sự kiện ACTIVATE: Dọn dẹp các bộ nhớ đệm cũ khi có phiên bản SW mới
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('SW: Đang xóa cache cũ:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Giành quyền kiểm soát tất cả các tab ngay lập tức
    );
});

// 3. Sự kiện FETCH: Đánh chặn các yêu cầu mạng để lấy dữ liệu từ Cache nếu mất mạng
self.addEventListener('fetch', (event) => {
    // Không can thiệp vào các yêu cầu không phải GET (như POST) hoặc các CDN bên ngoài nếu không cần thiết
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Nếu tìm thấy trong Cache, trả về luôn (Tốc độ cực nhanh)
            if (cachedResponse) {
                return cachedResponse;
            }

            // Nếu không có trong Cache, thực hiện tải từ internet
            return fetch(event.request).then((networkResponse) => {
                // Kiểm tra nếu phản hồi hợp lệ thì lưu lại vào cache để dùng lần sau
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Khi mất mạng hoàn toàn và tài nguyên không có trong cache
                // Bạn có thể trả về một trang offline.html mặc định ở đây nếu muốn
                console.log('SW: Thiết bị đang offline và không có dữ liệu cache cho:', event.request.url);
            });
        })
    );
});



/*! 
 * sw.js | Bản hợp nhất hoàn chỉnh: Sửa lỗi hiển thị cài đặt PWA & Giữ lõi bảo mật COI cho FFmpeg
 */

// 1. Nhập file coi-serviceworker.js để tự động ép các Header COOP/COEP giúp FFmpeg chạy được
importScripts('./coi-serviceworker.js');

// 2. Cấu hình Tên Cache và tài nguyên tĩnh để đạt chuẩn Offline PWA
const CACHE_NAME = 'video-cutter-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './coi-serviceworker.js',
    './favicon.png'
];

// Sự kiện INSTALL: Kích hoạt khi cài đặt ứng dụng, lưu toàn bộ tài nguyên vào Cache
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Ép kích hoạt ngay lập tức
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 PWA SW: Đang nạp tài nguyên tĩnh vào bộ nhớ đệm...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Sự kiện ACTIVATE: Dọn dẹp các bản cache cũ nếu bạn nâng cấp phiên bản ứng dụng
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim()); // Giành quyền kiểm soát trang ngay lập tức
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('🧹 PWA SW: Đang xóa cache cũ không dùng tới:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Sự kiện FETCH: Đánh chặn mạng - ĐÂY LÀ ĐOẠN QUYẾT ĐỊNH ĐỂ BẬT LẠI THÔNG BÁO CÀI ĐẶT PWA
self.addEventListener('fetch', (event) => {
    // Chỉ xử lý các yêu cầu lấy dữ liệu (GET) nội bộ, bỏ qua các phương thức khác (POST) hoặc extension
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Chiến lược Cache-First: Nếu tìm thấy trong bộ nhớ đệm, trả về luôn để tăng tốc ứng dụng
            if (cachedResponse) {
                return cachedResponse;
            }

            // Nếu không có trong Cache, tiến hành tải từ Internet
            return fetch(event.request).then((networkResponse) => {
                // Kiểm tra phản hồi có hợp lệ không trước khi lưu bản sao vào cache dự phòng
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Hỗ trợ trường hợp mất mạng hoàn toàn khi đang điều hướng trang
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

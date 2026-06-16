/*! sw.js | Hợp nhất PWA Offline Cache & COI Security Headers | Hoạt động hoàn hảo 2026 */

const CACHE_NAME = 'video-cutter-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './favicon.png'
];

// 1. Sự kiện Cài đặt (Install)
self.addEventListener('install', (event) => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log(' PWA: Đang khởi tạo bộ nhớ đệm cho tài nguyên cốt lõi...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Sự kiện Kích hoạt (Activate)
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log(' PWA: Đang dọn dẹp bộ nhớ đệm cũ:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// 3. Sự kiện Nhận yêu cầu (Fetch) - HỢP NHẤT KHÔNG XUNG ĐỘT
self.addEventListener('fetch', (event) => {
    // Bỏ qua các yêu cầu không phải GET hoặc từ extension bên ngoài
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Ngoại lệ đặc biệt của COI Service Worker
    if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Bước A: Tạo luồng tải mạng (Cho dù có cache hay không để lấy response gốc xử lý Header)
            const networkFetch = fetch(event.request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    // Tiến hành bóc tách và nhân bản Header bảo mật để kích hoạt SharedArrayBuffer cho FFmpeg
                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                    newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin"); 

                    const secureResponse = new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });

                    // Cập nhật ngầm vào Cache nếu phản hồi hợp lệ để duy trì trạng thái Offline
                    if (response.status === 200 && response.type === 'basic') {
                        const responseToCache = secureResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }

                    return secureResponse;
                })
                .catch((err) => {
                    console.error(" Mạng lỗi, đang cố gắng dùng tài nguyên dự phòng...", err);
                    // Khi mất mạng và không có cache, chuyển hướng về trang chủ
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });

            // Bước B: Chiến lược Ưu tiên Cache (Cache-First) để app PWA mở tức thì
            return cachedResponse || networkFetch;
        })
    );
});

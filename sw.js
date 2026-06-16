/*! sw.js | Bản sửa lỗi logic PWA Install & COI Security Headers | Hoạt động hoàn hảo */

const CACHE_NAME = 'video-cutter-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './coi-serviceworker.js',
    './favicon.png'
];

// 1. Sự kiện Cài đặt (Install)
self.addEventListener('install', (event) => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 PWA: Đang khởi tạo bộ nhớ đệm cho tài nguyên cốt lõi...');
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
                        console.log('🧹 PWA: Đang dọn dẹp bộ nhớ đệm cũ:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// 3. Sự kiện Nhận yêu cầu (Fetch) - ĐÃ ĐƯỢC TỐI ƯU HOÀN TOÀN
self.addEventListener('fetch', (event) => {
    // Chỉ xử lý các yêu cầu lấy dữ liệu (GET) nội bộ, bỏ qua các phương thức khác hoặc extension
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // ĐÚNG CHUẨN: Nếu tìm thấy trong bộ nhớ đệm, trả về luôn (Không gọi fetch lên mạng nữa)
            if (cachedResponse) {
                return cachedResponse;
            }

            // Nếu KHÔNG có trong Cache, mới tiến hành gọi mạng và chèn COI Headers cho FFmpeg
            return fetch(event.request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    // Sao chép và chèn các Header bảo mật bắt buộc cho SharedArrayBuffer (FFmpeg)
                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                    newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin"); 

                    const secureResponse = new Response(response.body, {\n                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders
                    });

                    // Lưu bản sao đã chèn Header vào bộ nhớ đệm dự phòng cho lần sau
                    if (response.status === 200 && response.type === 'basic') {
                        const responseToCache = secureResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }

                    return secureResponse;
                })
                .catch((err) => {
                    console.error("⚠️ Mạng lỗi hoặc đang Offline:", err);
                    // Khi mất mạng hoàn toàn và là trang điều hướng chính, trả về index.html cứu cánh
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
        })
    );
});

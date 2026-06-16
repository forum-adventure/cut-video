// Tên của bộ nhớ đệm (Thay đổi phiên bản khi bạn cập nhật code: v2, v3...)
const CACHE_NAME = 'video-cutter-cache-v1';

// Danh sách các tài nguyên bạn muốn lưu cache để chạy Offline
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
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

// 3. Sự kiện FETCH: Đánh chặn các yêu cầu mạng để lưu cache và chèn COOP/COEP Headers
self.addEventListener('fetch', (event) => {
    // Xử lý bảo mật chặn của coi-serviceworker đối với các yêu cầu đặc biệt
    if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
        return;
    }

    // Đối với các request không phải GET, chỉ xử lý chèn Header chứ không lưu Cache
    if (event.request.method !== 'GET') {
        event.respondWith(
            fetch(event.request)
                .then((response) => addCOOPHeaders(response))
                .catch((e) => console.error('SW Fetch Error:', e))
        );
        return;
    }

    // Quy trình xử lý cho yêu cầu GET: Kiểm tra Cache -> Fetch mạng -> Thêm Header -> Trả về
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Nếu có trong cache, vẫn cần đảm bảo có đủ Header COOP/COEP
                return addCOOPHeaders(cachedResponse);
            }

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    // Đối với tài nguyên bên ngoài (CDN, Google Font...), chỉ thêm Header chứ không lưu cache tĩnh basic
                    return addCOOPHeaders(networkResponse);
                }

                // Sao chép response để vừa lưu cache vừa trả về cho trình duyệt
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return addCOOPHeaders(networkResponse);
            }).catch(() => {
                console.log('SW: Thiết bị đang offline và không có dữ liệu cache cho:', event.request.url);
            });
        })
    );
});

// Hàm hỗ trợ chèn các Header COOP, COEP, CORP bắt buộc cho SharedArrayBuffer (FFmpeg WASM)
function addCOOPHeaders(response) {
    if (!response || response.status === 0) {
        return response;
    }

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
    newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin"); // Fix lỗi chặn script từ CDN

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}

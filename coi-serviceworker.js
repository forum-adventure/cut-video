/*! coi-serviceworker v0.1.7 + AutoCache Pro | MIT License */
const CACHE_NAME = 'ncox-ffmpeg-cache-v1';
// Danh sách các file lõi cần ép lưu vào bộ nhớ máy người dùng
const URLS_TO_CACHE = [
    './',
    'index.html',
    'coi-serviceworker.js',
    'ffmpeg.min.js',
    'ffmpeg-core.js',
    'ffmpeg-core.wasm'
];

if (typeof window === 'undefined') {
    // 1. Khi Service Worker được cài đặt, ép nó tải và lưu các file này vào bộ nhớ máy
    self.addEventListener("install", (event) => {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                console.log('[Service Worker] Đang găm file FFmpeg vào bộ nhớ máy...');
                return cache.addAll(URLS_TO_CACHE);
            }).then(() => self.skipWaiting())
        );
    });

    self.addEventListener("activate", (event) => {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cache) => {
                        if (cache !== CACHE_NAME) {
                            return caches.delete(cache);
                        }
                    })
                );
            }).then(() => self.clients.claim())
        );
    });

    // 2. Đọc file từ bộ nhớ máy (Kiểm tra dữ liệu offline trước) + Chèn Header bảo mật
    self.addEventListener("fetch", (event) => {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // Nếu tìm thấy file trong bộ nhớ đệm của máy, dùng luôn không lên mạng nữa
                if (cachedResponse) {
                    return injectHeaders(cachedResponse);
                }

                // Nếu không thấy (hoặc file mới), tải từ mạng về
                return fetch(event.request).then((response) => {
                    if (response.status === 0) {
                        return response;
                    }
                    return injectHeaders(response);
                }).catch((e) => console.error(e));
            })
        );
    });

    // Hàm chèn COOP và COEP bắt buộc để kích hoạt FFmpeg hoạt động
    function injectHeaders(response) {
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Cross-Origin-Opener-Policy", \"same-origin\");
        newHeaders.set("Cross-Origin-Embedder-Policy", \"require-corp\");
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
        });
    }
} else {
    // Đoạn mã đăng ký Service Worker chạy trên Trình duyệt
    (() => {
        const script = document.currentScript;
        if (navigator.serviceWorker) {
            navigator.serviceWorker.register(window.location.pathname + script.getAttribute(\"src\"))
                .then((registration) => {
                    registration.addEventListener("updatefound", () => {
                        window.location.reload();
                    });
                    if (registration.active && !navigator.serviceWorker.controller) {
                        window.location.reload();
                    }
                });
        }
    })();
}

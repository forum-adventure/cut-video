/*! coi-serviceworker v0.1.7 | MIT License | https://github.com/gzuidhof/coi-serviceworker */

// Định nghĩa các biến cấu hình Cache từ sw.js cũ của bạn
const CACHE_NAME = 'video-cutter-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './coi-serviceworker.js',
    './favicon.png'
];

if (typeof window === 'undefined') {
    // 1. Sự kiện INSTALL: Lưu cache các tài nguyên tĩnh và bỏ qua hàng chờ
    self.addEventListener("install", (event) => {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                console.log('SW: Đang lưu cache các tài nguyên tĩnh');
                return cache.addAll(ASSETS_TO_CACHE);
            }).then(() => self.skipWaiting())
        );
    });

    // 2. Sự kiện ACTIVATE: Dọn dẹp các bộ nhớ đệm phiên bản cũ
    self.addEventListener("activate", (event) => {
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
            }).then(() => self.clients.claim())
        );
    });

    // 3. Sự kiện FETCH: Hợp nhất xử lý COOP/COEP + Chiến lược Cache tĩnh
    self.addEventListener("fetch", (event) => {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        // Chỉ can thiệp xử lý Cache với các yêu cầu GET hợp lệ
        if (event.request.method === 'GET') {
            event.respondWith(
                caches.match(event.request).then((cachedResponse) => {
                    // Nếu tìm thấy trong bộ nhớ đệm, trả về luôn để tối ưu tốc độ Offline
                    if (cachedResponse) {
                        return cachedResponse; 
                    }

                    // Nếu không có trong Cache, tải trực tiếp từ mạng và bổ sung COOP/COEP Headers
                    return fetch(event.request)
                        .then((response) => {
                            if (response.status === 0) {
                                return response;
                            }
                            
                            // Thiết lập các Header bảo mật bắt buộc cho FFmpeg.wasm
                            const newHeaders = new Headers(response.headers);
                            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                            newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                            newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin"); 
                            
                            const modifiedResponse = new Response(response.body, {
                                status: response.status,
                                statusText: response.statusText,
                                headers: newHeaders,
                            });

                            // Lưu bản sao phản hồi đã chỉnh sửa Header vào cache cho lần sau (chỉ lưu các tài nguyên thuộc app tĩnh)
                            if (response.status === 200 && response.type === 'basic') {
                                const responseToCache = modifiedResponse.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                            }
                            
                            return modifiedResponse;
                        })
                        .catch((e) => {
                            console.error('SW Fetch Error:', e);
                        });
                })
            );
        } else {
            // Đối với các method không phải GET, xử lý qua cụm COI gốc không lưu cache
            event.respondWith(
                fetch(event.request)
                    .then((response) => {
                        if (response.status === 0) return response;
                        const newHeaders = new Headers(response.headers);
                        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                        newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin"); 
                        return new Response(response.body, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: newHeaders,
                        });
                    }).catch((e) => console.error(e))
            );
        }
    });
} else {
    // Đoạn mã tự động đăng ký chạy trên môi trường window (Trình duyệt)
    (() => {
        const script = document.currentScript;
        if (navigator.serviceWorker) {
            navigator.serviceWorker.register(window.location.pathname + script.getAttribute("src"))
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

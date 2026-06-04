/*! coi-serviceworker v0.1.7 | Tối ưu hóa Cache Offline & COOP/COEP bởi Ncox */
const CACHE_NAME = 'ncox-ffmpeg-cache-v1';
const ASSETS_TO_CACHE = [
    'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js'
];

if (typeof window === 'undefined') {
    // Kích hoạt ngay lập tức Service Worker khi cài đặt thành công
    self.addEventListener("install", (event) => {
        self.skipWaiting();
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                console.log("[Service Worker] Đang nạp trước FFmpeg Core vào bộ nhớ máy...");
                return cache.addAll(ASSETS_TO_CACHE);
            })
        );
    });

    self.addEventListener("activate", (event) => {
        event.waitUntil(
            self.clients.claim().then(() => {
                // Xóa bỏ các cache cũ nếu có thay đổi phiên bản
                return caches.keys().then((cacheNames) => {
                    return Promise.all(
                        cacheNames.map((cache) => {
                            if (cache !== CACHE_NAME) {
                                console.log("[Service Worker] Đang xóa bộ nhớ đệm cũ:", cache);
                                return caches.delete(cache);
                            }
                        })
                    );
                });
            })
        );
    });

    self.addEventListener("fetch", (event) => {
        // Bỏ qua các yêu cầu không hợp lệ trên iOS
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            // Chiến lược: Kiểm tra trong Cache trước, nếu có thì trả về ngay, không thì mới tải mạng
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    // Vẫn cần đính kèm các Header COOP/COEP cho phản hồi lấy ra từ Cache
                    const newHeaders = new Headers(cachedResponse.headers);
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                    
                    return new Response(cachedResponse.body, {
                        status: cachedResponse.status,
                        statusText: cachedResponse.statusText,
                        headers: newHeaders,
                    });
                }

                return fetch(event.request)
                    .then((response) => {
                        if (response.status === 0 || response.status > 400) {
                            return response;
                        }

                        const newHeaders = new Headers(response.headers);
                        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");

                        // Nhân bản phản hồi để đưa vào cache cho lần sau sử dụng
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            // Chỉ cache các tệp tin script hoặc tài nguyên tĩnh hệ thống
                            if (event.request.url.includes("ffmpeg") || event.request.mode === "navigate") {
                                cache.put(event.request, responseToCache);
                            }
                        });

                        return new Response(response.body, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: newHeaders,
                        });
                    })
                    .catch((e) => console.error("[Service Worker Fetch Error]:", e));
            })
        );
    });
} else {
    // Đoạn mã chạy trên môi trường Window (Trình duyệt chính)
    (() => {
        const script = document.currentScript;
        if (navigator.serviceWorker) {
            navigator.serviceWorker.register(window.location.pathname + script.getAttribute("src"))
                .then((registration) => {
                    registration.addEventListener("updatefound", () => {
                        console.log("[Service Worker] Đã tìm thấy bản cập nhật mới. Đang làm mới trang...");
                        window.location.reload();
                    });
                    if (registration.active && !navigator.serviceWorker.controller) {
                        window.location.reload();
                    }
                }).catch((err) => {
                    console.error("[Service Worker Register Giới hạn]:", err);
                });
        }
    })();
}

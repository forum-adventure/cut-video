/*! coi-serviceworker v0.1.7 | Tích hợp bộ nhớ đệm PWA Standard */
const CACHE_NAME = "ncox-hybrid-v1";
const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./manifest.json"
];

if (typeof window === 'undefined') {
    // Khi cài đặt, bắt buộc nạp các file nền tảng vào cache lưu trữ
    self.addEventListener("install", (event) => {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
        );
        self.skipWaiting();
    });

    self.addEventListener("activate", (event) => {
        event.waitUntil(self.clients.claim());
    });

    self.addEventListener("fetch", (event) => {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }
        
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }
                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                    newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin"); 
                    
                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch(async () => {
                    // Nếu mất mạng hoặc không fetch được, tìm kiếm trong kho Cache đã lưu
                    const cachedResponse = await caches.match(event.request);
                    if (cachedResponse) return cachedResponse;
                    console.error("Không thể kết nối internet và không có dữ liệu cache tương ứng.");
                })
        );
    });
} else {
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

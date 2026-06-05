/*! coi-serviceworker v0.1.7 | Sửa lỗi FFmpeg.wasm & Tích hợp PWA Cache */
const CACHE_NAME = "video-cutter-pwa-v2";
const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./manifest.json"
];

if (typeof window === 'undefined') {
    // 1. Chỉ lưu Cache các file tĩnh nội bộ (Local Assets) để chạy giao diện PWA
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

    // 2. Xử lý Fetch: Vừa đảm bảo COOP/COEP cho FFmpeg.wasm, vừa không làm lỗi CDN
    self.addEventListener("fetch", (event) => {
        const requestUrl = new URL(event.request.url);

        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    // Tạo bản sao Header và ép cấu hình COOP/COEP bắt buộc cho FFmpeg hoạt động
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
                .catch(async (error) => {
                    // Nếu là file nội bộ và bị mất mạng, lấy từ Cache ra dùng
                    if (requestUrl.origin === self.location.origin) {
                        const cachedResponse = await caches.match(event.request);
                        if (cachedResponse) return cachedResponse;
                    }
                    // Nếu là file FFmpeg từ CDN bên ngoài mà mất mạng thì đành chịu
                    console.error("Lỗi kết nối mạng mạng hoặc file CDN: ", error);
                })
        );
    });
} else {
    // Phần đăng ký Service Worker chạy trên Trình duyệt (Được giữ nguyên từ thư viện gốc)
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

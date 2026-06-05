/*! coi-serviceworker v0.1.7 | MIT License | https://github.com/gzuidhof/coi-serviceworker */
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
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
                    // BỔ SUNG DÒNG NÀY ĐỂ FIX LỖI CHẶN SCRIPT CDN
                    newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin"); 
                    
                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((e) => console.error(e))
        );
    });
} else {
    (() => {
        const script = document.currentScript;
        if (navigator.serviceWorker) {
            // SỬA ĐỔI TẠI ĐÂY: Sử dụng đối tượng URL để tính toán chính xác đường dẫn chạy trên GitHub Pages phụ (Sub-folder)
            const scriptSrc = script.getAttribute("src");
            const swUrl = new URL(scriptSrc, window.location.href).href;

            navigator.serviceWorker.register(swUrl)
                .then((registration) => {
                    registration.addEventListener("updatefound", () => {
                        window.location.reload();
                    });
                    if (registration.active && !navigator.serviceWorker.controller) {
                        window.location.reload();
                    }
                })
                .catch((err) => {
                    console.error("❌ Không thể đăng ký Service Worker do sai đường dẫn:", err);
                });
        }
    })();
}

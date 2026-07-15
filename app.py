from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class SecureStaticHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
    }

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        super().end_headers()


if __name__ == "__main__":
    host = "127.0.0.1"
    port = 8080
    print(f"Sistema Pegaso disponible en http://{host}:{port}")
    ThreadingHTTPServer((host, port), SecureStaticHandler).serve_forever()

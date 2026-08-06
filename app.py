import socket
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


def get_network_addresses():
    addresses = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            addresses.append(sock.getsockname()[0])
    except OSError:
        pass

    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_DGRAM):
            ip = info[4][0]
            if ip not in addresses and not ip.startswith("127."):
                addresses.append(ip)
    except OSError:
        pass

    if "127.0.0.1" not in addresses:
        addresses.append("127.0.0.1")
    return addresses


if __name__ == "__main__":
    host = "0.0.0.0"
    port = 8080
    print(f"Sistema Pegaso disponible en http://{host}:{port}")
    for address in get_network_addresses():
        print(f"Acceso desde red: http://{address}:{port}")
    ThreadingHTTPServer((host, port), SecureStaticHandler).serve_forever()

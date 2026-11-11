import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress

fun main() {
    val server = HttpServer.create(InetSocketAddress("127.0.0.1", 8080), 0)
    server.createContext("/") { exchange ->
        try {
            if (exchange.requestURI.path != "/") {
                exchange.sendResponseHeaders(404, -1)
            } else if (exchange.requestMethod != "GET") {
                exchange.responseHeaders.set("Allow", "GET")
                exchange.sendResponseHeaders(405, -1)
            } else {
                val body = "{\"message\":\"Hello from __PROJECT_NAME__!\"}".toByteArray()
                exchange.responseHeaders.set("Content-Type", "application/json")
                exchange.sendResponseHeaders(200, body.size.toLong())
                exchange.responseBody.use { it.write(body) }
            }
        } finally {
            exchange.close()
        }
    }
    server.start()
    println("Listening on http://127.0.0.1:8080")
}

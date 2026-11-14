package example.app

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@SpringBootApplication(proxyBeanMethods = false)
@RestController
class Application {
    @GetMapping("/healthz")
    fun health() = mapOf("status" to "ok")

    @GetMapping("/hello")
    fun hello(@RequestParam(name = "name", defaultValue = "world") name: String) =
        mapOf("message" to "Hello, $name!")
}

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}

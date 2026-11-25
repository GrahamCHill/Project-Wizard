package example.app

import org.springframework.boot.CommandLineRunner
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication(proxyBeanMethods = false)
class Application : CommandLineRunner {
    override fun run(vararg args: String) {
        println("Hello, ${args.firstOrNull() ?: "world"}!")
    }
}

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}

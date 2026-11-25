package example.app

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.stereotype.Controller
import org.springframework.ui.Model
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseBody

@SpringBootApplication(proxyBeanMethods = false)
@Controller
class Application {
    @GetMapping("/")
    fun home(@RequestParam(name = "name", defaultValue = "world") name: String, model: Model): String {
        model.addAttribute("name", name)
        return "index"
    }

    @GetMapping("/healthz")
    @ResponseBody
    fun health() = mapOf("status" to "ok")
}

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}

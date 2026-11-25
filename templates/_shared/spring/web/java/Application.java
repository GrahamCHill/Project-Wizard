package example.app;

import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

@SpringBootApplication(proxyBeanMethods = false)
@Controller
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @GetMapping("/")
    public String home(@RequestParam(name = "name", defaultValue = "world") String name, Model model) {
        model.addAttribute("name", name);
        return "index";
    }

    @GetMapping("/healthz")
    @ResponseBody
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}

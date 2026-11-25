package example.app

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.Customizer
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.SecurityFilterChain

@Configuration(proxyBeanMethods = false)
class SecurityConfig {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain = http
        .authorizeHttpRequests { requests -> requests
            .requestMatchers("/healthz", "/actuator/health", "/actuator/health/**").permitAll()
            .anyRequest().authenticated()
        }
        .httpBasic(Customizer.withDefaults())
        .build()
}

#include <iostream>
#include <nlohmann/json.hpp>

int main()
{
    const auto object = nlohmann::json::parse(R"({"message":"Hello from nlohmann/json"})");
    std::cout << object.at("message").get<std::string>() << '\n';
}

#include <iostream>
#include <cxxopts.hpp>

int main(int argc, char **argv)
{
    cxxopts::Options options("example_cxxopts", "Try --name Ada");
    options.add_options()
        ("name", "Name to greet", cxxopts::value<std::string>()->default_value("world"));
    const auto arguments = options.parse(argc, argv);
    std::cout << "Hello, " << arguments["name"].as<std::string>() << "!\n";
}

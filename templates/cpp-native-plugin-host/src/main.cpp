#include "native_plugin.h"

#include <exception>
#include <iostream>

namespace fs = std::filesystem;

int main(int argc, char **argv)
{
    try {
        const auto directory = argc > 1 ? fs::absolute(argv[1]) : executable_path().parent_path() / "plugins";
        for (const auto &file : plugin_files(directory)) {
            if (!is_native_plugin(file)) continue;
            try {
                const auto greeting = native_greeting(file);
                std::cout << file.filename().string() << ": " << greeting << '\n';
            } catch (const std::exception &error) {
                std::cerr << "Skipped " << file.filename().string() << ": " << error.what() << '\n';
            }
        }
        return 0;
    } catch (const std::exception &error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}

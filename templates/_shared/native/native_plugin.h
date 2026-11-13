#pragma once

#include <filesystem>
#include <string>
#include <vector>

std::filesystem::path executable_path();
std::vector<std::filesystem::path> plugin_files(const std::filesystem::path &directory);
bool is_native_plugin(const std::filesystem::path &file);
std::string native_greeting(const std::filesystem::path &file);

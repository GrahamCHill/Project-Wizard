#include "native_plugin.h"
#include "plugin_api.h"

#include <algorithm>
#include <stdexcept>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#elif defined(__APPLE__)
#include <dlfcn.h>
#include <mach-o/dyld.h>
#else
#include <dlfcn.h>
#endif

namespace fs = std::filesystem;

fs::path executable_path()
{
#ifdef _WIN32
    std::wstring buffer(32768, L'\0');
    const auto size = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (size == 0 || size >= buffer.size()) throw std::runtime_error("Could not find the executable.");
    buffer.resize(size);
    return buffer;
#elif defined(__APPLE__)
    uint32_t size = 0;
    _NSGetExecutablePath(nullptr, &size);
    std::vector<char> buffer(size);
    if (_NSGetExecutablePath(buffer.data(), &size) != 0) throw std::runtime_error("Could not find the executable.");
    return fs::canonical(buffer.data());
#else
    return fs::read_symlink("/proc/self/exe");
#endif
}

class NativePlugin {
public:
#ifdef _WIN32
    static constexpr auto extension = ".dll";
    explicit NativePlugin(const fs::path &file)
        : handle(LoadLibraryExW(file.c_str(), nullptr, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS))
    {
        if (!handle) throw std::runtime_error("LoadLibraryEx failed: " + std::to_string(GetLastError()));
    }
    ~NativePlugin() { FreeLibrary(handle); }
    template<class Function> Function symbol(const char *name) const
    {
        return reinterpret_cast<Function>(GetProcAddress(handle, name));
    }
private:
    HMODULE handle;
#else
#if defined(__APPLE__)
    static constexpr auto extension = ".dylib";
#else
    static constexpr auto extension = ".so";
#endif
    explicit NativePlugin(const fs::path &file) : handle(dlopen(file.c_str(), RTLD_NOW | RTLD_LOCAL))
    {
        if (!handle) throw std::runtime_error(dlerror());
    }
    ~NativePlugin() { dlclose(handle); }
    template<class Function> Function symbol(const char *name) const
    {
        return reinterpret_cast<Function>(dlsym(handle, name));
    }
private:
    void *handle;
#endif
public:
    NativePlugin(const NativePlugin &) = delete;
    NativePlugin &operator=(const NativePlugin &) = delete;
};

std::string native_greeting(const fs::path &file)
{
    const NativePlugin plugin(file);
    const auto version = plugin.symbol<uint32_t (*)()>("plugin_api_version");
    const auto greet = plugin.symbol<const char *(*)()>("plugin_greet");
    if (!version || !greet || version() != PLUGIN_API_VERSION)
        throw std::runtime_error("Missing or incompatible plugin API.");
    const char *message = greet();
    if (!message) throw std::runtime_error("Plugin returned no greeting.");
    return message;
}

std::vector<fs::path> plugin_files(const fs::path &directory)
{
    if (!fs::is_directory(directory)) throw std::runtime_error("No plugin directory at " + directory.string());

    std::vector<fs::path> files;
    for (const auto &entry : fs::directory_iterator(directory))
        if (entry.is_regular_file()) files.push_back(entry.path());
    std::sort(files.begin(), files.end());
    return files;
}

bool is_native_plugin(const fs::path &file)
{
    return file.extension() == NativePlugin::extension;
}

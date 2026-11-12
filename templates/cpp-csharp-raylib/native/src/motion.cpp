#include <cstdint>

#if defined(_WIN32)
#define PW_EXPORT __declspec(dllexport)
#else
#define PW_EXPORT __attribute__((visibility("default")))
#endif

extern "C" PW_EXPORT std::int32_t pw_advance(
    std::int32_t position, std::int32_t step, std::int32_t width) noexcept
{
    if (width <= 0) {
        return 0;
    }

    const auto next = (static_cast<std::int64_t>(position) + step) % width;
    return static_cast<std::int32_t>(next < 0 ? next + width : next);
}

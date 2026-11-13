include(FetchContent)

__SFML_LEGACY_POLICIES__set(BUILD_SHARED_LIBS OFF)
set(SFML_BUILD_AUDIO OFF CACHE BOOL "Build SFML audio")
set(SFML_BUILD_NETWORK OFF CACHE BOOL "Build SFML networking")

FetchContent_Declare(sfml
    URL https://codeload.github.com/SFML/SFML/tar.gz/refs/tags/__SFML_VERSION__
    URL_HASH SHA256=__SFML_HASH__
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    EXCLUDE_FROM_ALL
)
FetchContent_MakeAvailable(sfml)

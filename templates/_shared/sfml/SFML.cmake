include(FetchContent)

set(BUILD_SHARED_LIBS OFF)
set(SFML_BUILD_AUDIO OFF CACHE BOOL "Build SFML audio")
set(SFML_BUILD_NETWORK OFF CACHE BOOL "Build SFML networking")

FetchContent_Declare(sfml
    URL https://codeload.github.com/SFML/SFML/tar.gz/refs/tags/3.1.0
    URL_HASH SHA256=91209a112c2bd0bc6f4ce0d5f3e413cfb48b57c0de59f5507dc81f71b1ad7a5c
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    EXCLUDE_FROM_ALL
)
FetchContent_MakeAvailable(sfml)

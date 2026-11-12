cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES C)

find_package(PkgConfig REQUIRED)
pkg_check_modules(GTK REQUIRED IMPORTED_TARGET gtk4)

add_executable(app src/main.c)
target_compile_features(app PRIVATE c_std_11)
target_link_libraries(app PRIVATE PkgConfig::GTK)

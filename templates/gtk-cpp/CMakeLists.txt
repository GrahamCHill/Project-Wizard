cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX)

find_package(PkgConfig REQUIRED)
pkg_check_modules(GTKMM REQUIRED IMPORTED_TARGET gtkmm-4.0)

add_executable(app src/main.cpp)
target_compile_features(app PRIVATE cxx_std_17)
target_link_libraries(app PRIVATE PkgConfig::GTKMM)

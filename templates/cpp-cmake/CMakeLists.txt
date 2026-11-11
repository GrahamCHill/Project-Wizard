cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX)

add_executable(app src/main.cpp)
target_compile_features(app PRIVATE cxx_std_17)

cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES C)

add_executable(app src/main.c)
target_compile_features(app PRIVATE c_std_11)

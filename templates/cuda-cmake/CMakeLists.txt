cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX CUDA)

add_executable(app src/main.cu)
set_target_properties(app PROPERTIES CUDA_STANDARD 17 CUDA_STANDARD_REQUIRED ON)

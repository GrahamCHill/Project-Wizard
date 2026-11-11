cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX CUDA)

find_package(CUDAToolkit REQUIRED)
add_library(kernels STATIC src/sum.cu)
set_target_properties(kernels PROPERTIES CUDA_STANDARD 17 CUDA_STANDARD_REQUIRED ON)
target_include_directories(kernels PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include")
target_link_libraries(kernels PUBLIC CUDA::cudart)

add_executable(app src/main.cpp)
target_compile_features(app PRIVATE cxx_std_17)
target_link_libraries(app PRIVATE kernels)

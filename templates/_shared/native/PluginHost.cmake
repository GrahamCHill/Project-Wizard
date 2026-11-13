add_executable(app src/main.cpp src/native_plugin.cpp)
target_compile_features(app PRIVATE cxx_std_17)
target_include_directories(app PRIVATE include)
target_link_libraries(app PRIVATE ${CMAKE_DL_LIBS})
set_target_properties(app PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/$<CONFIG>")

add_library(sample_plugin MODULE src/sample_plugin.cpp)
target_compile_features(sample_plugin PRIVATE cxx_std_17)
target_include_directories(sample_plugin PRIVATE include)
set_target_properties(sample_plugin PROPERTIES PREFIX ""
    CXX_VISIBILITY_PRESET hidden
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/$<CONFIG>/plugins"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/$<CONFIG>/plugins")
if(APPLE)
    set_target_properties(sample_plugin PROPERTIES SUFFIX ".dylib")
endif()
add_dependencies(app sample_plugin)

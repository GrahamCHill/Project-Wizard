cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX)

find_package(__QT_PACKAGE__ __QT_MINIMUM__ REQUIRED COMPONENTS Quick)
__QT_QUICK_PROJECT__
target_compile_features(app PRIVATE cxx_std_17)
target_link_libraries(app PRIVATE __QT_PACKAGE__::Quick)

#include "starter.h"
#include "sum.hpp"
#include <iostream>

int main()
{
    int result = 0;
    const cudaError_t status = gpuSum(2, 3, result);
    if (status != cudaSuccess) {
        std::cerr << cudaGetErrorString(status) << '\n';
        return 1;
    }

    std::cout << "__PROJECT_NAME__: 2 + 3 = " << result << '\n';
    return result == starter_add(2, 3) ? 0 : 1;
}

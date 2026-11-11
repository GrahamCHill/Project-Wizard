#include "sum.hpp"
#include <cuda_runtime.h>

namespace {
__global__ void sum(int *output, int left, int right)
{
    *output = left + right;
}
}

cudaError_t gpuSum(int left, int right, int &result)
{
    int *output = nullptr;
    cudaError_t status = cudaMalloc(&output, sizeof(int));
    if (status != cudaSuccess) {
        return status;
    }

    sum<<<1, 1>>>(output, left, right);
    status = cudaGetLastError();
    if (status == cudaSuccess) {
        status = cudaMemcpy(&result, output, sizeof(int), cudaMemcpyDeviceToHost);
    }
    const cudaError_t cleanup = cudaFree(output);
    return status == cudaSuccess ? cleanup : status;
}

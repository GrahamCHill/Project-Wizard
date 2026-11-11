#include <cuda_runtime.h>
#include <cstdio>

__global__ void add(int *result, int left, int right)
{
    *result = left + right;
}

int main()
{
    int *deviceResult = nullptr;
    cudaError_t status = cudaMalloc(&deviceResult, sizeof(int));
    if (status != cudaSuccess) {
        std::fprintf(stderr, "cudaMalloc: %s\n", cudaGetErrorString(status));
        return 1;
    }

    add<<<1, 1>>>(deviceResult, 2, 3);
    status = cudaGetLastError();
    int result = 0;
    if (status == cudaSuccess) {
        status = cudaMemcpy(&result, deviceResult, sizeof(int), cudaMemcpyDeviceToHost);
    }
    cudaFree(deviceResult);
    if (status != cudaSuccess) {
        std::fprintf(stderr, "CUDA kernel: %s\n", cudaGetErrorString(status));
        return 1;
    }

    std::printf("__PROJECT_NAME__: 2 + 3 = %d\n", result);
    return result == 5 ? 0 : 1;
}

#pragma once

#include <cuda_runtime_api.h>

cudaError_t gpuSum(int left, int right, int &result);

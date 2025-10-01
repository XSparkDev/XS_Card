# CMake configuration for XS Card app
cmake_minimum_required(VERSION 3.22.1)

# Set shorter build directory to avoid Windows path length issues
set(CMAKE_BINARY_DIR "${CMAKE_SOURCE_DIR}/build")
set(CMAKE_CURRENT_BINARY_DIR "${CMAKE_BINARY_DIR}")

# Configure for shorter paths on Windows
if(WIN32)
    # Use shorter object file paths
    set(CMAKE_OBJECT_PATH_MAX 200)
    set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")
    set(CMAKE_LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib")
    set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib")
endif()

# Basic project configuration
project(XSCardApp)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

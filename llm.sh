#!/bin/bash

# Usage: ./combine_files.sh /path/to/directory /path/to/output_file

input_dir=$1
output_file=$2

# Clear output file if it already exists
> "$output_file"

# Function to recursively process all files
combine_files() {
  local dir=$1
  for file in "$dir"/*; do
    if [ -d "$file" ]; then
      # If it's a directory, recurse
      combine_files "$file"
    elif [ -f "$file" ]; then
      # If it's a file, append its path and contents to the output file
      echo "Processing file: $file"
      echo "=== $file ===" >> "$output_file"
      cat "$file" >> "$output_file"
      echo -e "\n" >> "$output_file"
    fi
  done
}

# Start combining files
combine_files "$input_dir"

echo "Files combined into $output_file"

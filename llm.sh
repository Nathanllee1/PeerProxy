#!/bin/bash

# Output file
output_file="output.txt"

# Empty the output file if it exists
> "$output_file"

# Define the file extensions to include
extensions="ts|js|go|html|css"

# Define the patterns to exclude (converted to regex)
exclude_patterns=(
    # Logs
    '/logs/'
    '\.log$'
    'npm-debug\.log'
    'yarn-debug\.log'
    'yarn-error\.log'
    'pnpm-debug\.log'
    'lerna-debug\.log'
    '\.pem$'
    '\.local$'

    # Node modules and dist directories
    '/node_modules/'
    '/dist/'
    '/dist-ssr/'

    # Editor directories and files
    '/\.vscode/'
    '/\.idea/'
    '\.DS_Store$'
    '\.suo$'
    '\.ntvs'
    '\.njsproj$'
    '\.sln$'
    '\.sw.$'

    # Media and uploads
    '/uploads/'
    '\.mp4$'
    '/videos/'
    '\.mp4$'
    '\.local$'
)

# Build the grep exclude pattern
exclude_regex=$(printf "|%s" "${exclude_patterns[@]}")
exclude_regex=${exclude_regex:1}  # Remove leading |

# Find files with the specified extensions and exclude patterns
find goclient jsClient -type f \( -iname "*.ts" -o -iname "*.js" -o -iname "*.go" -o -iname "*.html" -o -iname "*.css" \) \
    | grep -Ev "$exclude_regex" \
    | while read -r file; do
        # Get the relative path
        relative_path="${file#./}"

        # Append header with relative path
        echo "===== $relative_path =====" >> "$output_file"

        # Append file content
        cat "$file" >> "$output_file"

        # Add a newline for separation
        echo >> "$output_file"
    done

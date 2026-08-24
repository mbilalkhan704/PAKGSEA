from pathlib import Path

def print_tree(directory, prefix=""):
    directory = Path(directory)

    entries = sorted(directory.iterdir(), key=lambda x: (x.is_file(), x.name.lower()))

    for index, entry in enumerate(entries):
        is_last = index == len(entries) - 1

        connector = "└── " if is_last else "├── "
        print(prefix + connector + entry.name)

        if entry.is_dir():
            extension = "    " if is_last else "│   "
            print_tree(entry, prefix + extension)


current_directory = Path.cwd()

print(current_directory)
print_tree(current_directory)
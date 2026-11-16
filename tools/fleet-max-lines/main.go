package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	hits, err := scan(abs)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	sort.Slice(hits, func(i, j int) bool {
		if hits[i].Limit != hits[j].Limit {
			return hits[i].Limit < hits[j].Limit
		}
		return hits[i].Lines > hits[j].Lines
	})
	for _, v := range hits {
		switch v.Kind {
		case "dir":
			fmt.Fprintf(os.Stderr, "bloated-dir: %s (%d lines in %d files > %d)\n", v.Path, v.Lines, v.Files, v.Limit)
		case "file":
			if v.Limit == 0 {
				fmt.Fprintf(os.Stderr, "forbidden-script: %s (%d lines; .js/.mjs is not fleet source)\n", v.Path, v.Lines)
				continue
			}
			fmt.Fprintf(os.Stderr, "bloated-file: %s (%d lines > %d)\n", v.Path, v.Lines, v.Limit)
		}
	}
	if len(hits) > 0 {
		os.Exit(1)
	}
	fmt.Printf("line check passed (file ≤%d; directory ≤%d; .js/.mjs must be empty)\n", sourceLimit, dirLimit)
}

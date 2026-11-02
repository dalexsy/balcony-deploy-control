package main

import (
	"encoding/json"
	"os"
	"strings"
)

func patchStylePackage(path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var pkg map[string]any
	if err := decode(strings.NewReader(string(raw)), &pkg); err != nil {
		return err
	}
	exports, ok := pkg["exports"].(map[string]any)
	if !ok {
		exports = map[string]any{}
	}
	exports["./styles"] = map[string]string{"default": "./src/lib/styles/index.scss"}
	exports["./styles/layout"] = map[string]string{"default": "./src/lib/styles/_layout.scss"}
	pkg["exports"] = exports
	pkg["sideEffects"] = []string{"*.scss", "*.css"}
	data, err := json.MarshalIndent(pkg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0644)
}

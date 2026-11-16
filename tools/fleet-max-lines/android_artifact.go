package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// The native Rhino asset is compiled from shared frontend TypeScript. Its
// generator's paired metadata hashes canonical LF bytes. This recognizes that
// retained artifact, not handwritten JS, other paths, or any MJS file.
func isAndroidEstimatorArtifact(root, rel string, content []byte) bool {
	if rel != "app/src/main/assets/row-estimator.generated.js" {
		return false
	}
	raw, err := os.ReadFile(filepath.Join(root, "app/src/main/assets/row-estimator.meta.json"))
	if err != nil {
		return false
	}
	var meta struct {
		Version string `json:"estimatorVersion"`
		Hash    string `json:"sourceHash"`
	}
	if json.Unmarshal(raw, &meta) != nil || !regexp.MustCompile(`^[a-z0-9][a-z0-9-]{2,80}$`).MatchString(meta.Version) ||
		!regexp.MustCompile(`^[a-f0-9]{16}$`).MatchString(meta.Hash) {
		return false
	}
	text := strings.ReplaceAll(string(content), "\r\n", "\n")
	digest := sha256.Sum256([]byte(text))
	if hex.EncodeToString(digest[:])[:16] != meta.Hash {
		return false
	}
	return strings.HasPrefix(text, "\"use strict\";\nvar RowEstimator = (() => {") &&
		strings.Contains(text, "var ROW_ESTIMATOR_VERSION = "+`"`+meta.Version+`";`) &&
		strings.Contains(text, "function liveEstimateFromInputs(input)") &&
		strings.HasSuffix(strings.TrimSpace(text), "return __toCommonJS(row_estimator_bundle_entry_exports);\n})();")
}

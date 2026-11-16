package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAndroidEstimatorArtifact(t *testing.T) {
	const path = "app/src/main/assets/row-estimator.generated.js"
	const bundle = "\"use strict\";\nvar RowEstimator = (() => {\nvar ROW_ESTIMATOR_VERSION = \"test-v1\";\nfunction liveEstimateFromInputs(input) {}\nreturn __toCommonJS(row_estimator_bundle_entry_exports);\n})();\n"
	for _, scenario := range []string{"valid", "crlf", "tampered", "missing", "bad-json", "bad-hash", "bad-version", "wrong-path", "mjs-path"} {
		t.Run(scenario, func(t *testing.T) {
			root := t.TempDir()
			folder := filepath.Join(root, "app/src/main/assets")
			if err := os.MkdirAll(folder, 0700); err != nil {
				t.Fatal(err)
			}
			digest := sha256.Sum256([]byte(bundle))
			meta := map[string]string{"estimatorVersion": "test-v1", "sourceHash": hex.EncodeToString(digest[:])[:16]}
			if scenario == "bad-version" {
				meta["estimatorVersion"] = "other-v1"
			}
			if scenario == "bad-hash" {
				meta["sourceHash"] = "not-a-hash"
			}
			raw, _ := json.Marshal(meta)
			if scenario == "bad-json" {
				raw = []byte("{")
			}
			if scenario != "missing" {
				if err := os.WriteFile(filepath.Join(folder, "row-estimator.meta.json"), raw, 0600); err != nil {
					t.Fatal(err)
				}
			}
			body, rel := bundle, path
			if scenario == "tampered" {
				body += "extra code"
			}
			if scenario == "crlf" {
				body = strings.ReplaceAll(bundle, "\n", "\r\n")
			}
			if scenario == "wrong-path" {
				rel = "src/row-estimator.generated.js"
			}
			if scenario == "mjs-path" {
				rel = "app/src/main/assets/row-estimator.generated.mjs"
			}
			want := scenario == "valid" || scenario == "crlf"
			if got := isAndroidEstimatorArtifact(root, rel, []byte(body)); got != want {
				t.Fatalf("got %v want %v", got, want)
			}
			if scenario == "valid" {
				if err := os.WriteFile(filepath.Join(root, filepath.FromSlash(path)), []byte(body), 0600); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(folder, "unrelated.js"), []byte("unrelated"), 0600); err != nil {
					t.Fatal(err)
				}
				hits, err := scan(root)
				if err != nil || len(hits) != 1 || !strings.HasSuffix(hits[0].Path, "unrelated.js") {
					t.Fatalf("%+v %v", hits, err)
				}
			}
		})
	}
}

package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFieldFailsClosed(t *testing.T) {
	for _, raw := range []string{`{}`, `null`, `{"sha":null}`, `{"sha":4}`, `{"sha":""}`, `{"sha":"ok"} {}`, `broken`} {
		if _, err := field(strings.NewReader(raw), "sha"); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
	var out bytes.Buffer
	if err := run([]string{"field", "sha"}, strings.NewReader(`{"sha":"abc"}`), &out); err != nil || out.String() != "abc\n" {
		t.Fatalf("valid identity: output=%q err=%v", out.String(), err)
	}
}

func TestStreamReadiness(t *testing.T) {
	good := `{"ok":true,"video":{"fragmentsSent":1,"remuxFps":0.25,"lastChunkAgeMs":24000}}`
	if err := streamReady(strings.NewReader(good)); err != nil {
		t.Fatal(err)
	}
	for _, raw := range []string{
		`{}`, `{"ok":true,"video":{}}`, strings.Replace(good, `true`, `false`, 1),
		strings.Replace(good, `"fragmentsSent":1`, `"fragmentsSent":0`, 1),
		strings.Replace(good, `0.25`, `0.24`, 1), strings.Replace(good, `24000`, `24001`, 1),
		strings.Replace(good, `24000`, `-1`, 1), strings.Replace(good, `0.25`, `null`, 1),
		strings.Replace(good, `0.25`, `"0.25"`, 1), good + ` {}`,
	} {
		if err := streamReady(strings.NewReader(raw)); err == nil {
			t.Fatalf("accepted unhealthy %s", raw)
		}
	}
}

func TestStagingRequiresLiveIdentity(t *testing.T) {
	health := `{"ok":true,"watchAssetVersion":"v2","issues":[],"stream":{"connected":true,"remuxInitReady":true}}`
	manifest := `{"commitSha":"abc","watchAssetVersion":"v2"}`
	if err := stagingReady(health, manifest, "abc", "v2"); err != nil {
		t.Fatal(err)
	}
	for _, h := range []string{`{}`, strings.Replace(health, `v2`, `v1`, 1), strings.Replace(health, `true`, `false`, 1),
		strings.Replace(health, `[]`, `["stale"]`, 1), strings.Replace(health, `"connected":true`, `"connected":false`, 1)} {
		if err := stagingReady(h, manifest, "abc", "v2"); err == nil {
			t.Fatalf("accepted unhealthy/stale %s", h)
		}
	}
	if err := stagingReady(health, manifest, "other", "v2"); err == nil {
		t.Fatal("accepted wrong commit")
	}
	if err := stagingReady(health, `{}`, "abc", "v2"); err == nil {
		t.Fatal("accepted absent manifest")
	}
}

func TestStylePackagePreservesExistingExports(t *testing.T) {
	path := filepath.Join(t.TempDir(), "package.json")
	if err := os.WriteFile(path, []byte(`{"name":"ui","exports":{".":{"default":"./index.js"}}}`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := patchStylePackage(path); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(data, []byte("./index.js")) || !bytes.Contains(data, []byte("./src/lib/styles/index.scss")) {
		t.Fatalf("lost package exports: %s", data)
	}
}

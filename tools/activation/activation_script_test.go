package main

import (
	"crypto/sha256"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// Exercise the real entrypoint with isolated transport/process boundaries.
// Mock verification success is never evidence of production delivery.
func TestActivationCannotSkipRemoteOrVerification(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX runner integration")
	}
	for _, mode := range []string{"static", "restart"} {
		for _, failure := range []string{"none", "remote", "verify"} {
			t.Run(mode+"/"+failure, func(t *testing.T) {
				root := t.TempDir()
				write := func(name, data string) {
					path := filepath.Join(root, name)
					if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
						t.Fatal(err)
					}
					if err := os.WriteFile(path, []byte(data), 0700); err != nil {
						t.Fatal(err)
					}
				}
				write("directory/scripts/dryl-static-sites.json", "{}")
				write("directory/tools/fleetctl/main.go", "package main")
				write("balcony-log/package.json", "{}")
				write("artifact", "")
				write("bin/scp", "#!/bin/sh\nexit 0\n")
				write("bin/ssh", "#!/bin/sh\ncat >/dev/null\n[ \"$FAILURE\" != remote ]\n")
				write("bin/go", "#!/bin/sh\n[ \"$FAILURE\" != verify ] || exit 1\nprintf '[shipVerify] ok balcony\\n'\n")
				script, err := filepath.Abs("../../scripts/activate-production.sh")
				if err != nil {
					t.Fatal(err)
				}
				cmd := exec.Command("bash", script, filepath.Join(root, "artifact"),
					fmt.Sprintf("%x", sha256.Sum256(nil)), strings.Repeat("a", 40), mode)
				cmd.Env = append(os.Environ(), "PATH="+filepath.Join(root, "bin")+":"+os.Getenv("PATH"),
					"HOME="+root, "REPOS_ROOT="+root, "DRYL_PASS=test-only", "FAILURE="+failure,
					"DRYL_ACTIVATE_SKIP_REMOTE=1")
				output, err := cmd.CombinedOutput()
				if failure == "none" {
					if err != nil || !strings.Contains(string(output), "[shipVerify] ok balcony") {
						t.Fatalf("%v: %s", err, output)
					}
				} else if err == nil {
					t.Fatalf("accepted failed %s: %s", failure, output)
				}
				if failure == "remote" && strings.Contains(string(output), "post-activate manifest shipVerify") {
					t.Fatal("verification ran despite failed remote activation")
				}
			})
		}
	}
}

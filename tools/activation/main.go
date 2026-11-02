// activation-check validates deployment evidence without a Python runtime.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
)

func decode(r io.Reader, target any) error {
	data, err := io.ReadAll(io.LimitReader(r, (1<<20)+1))
	if err != nil {
		return err
	}
	if len(data) > 1<<20 {
		return errors.New("deployment JSON exceeds 1 MiB")
	}
	return json.Unmarshal(data, target)
}

func field(r io.Reader, name string) (string, error) {
	var object map[string]json.RawMessage
	if err := decode(r, &object); err != nil {
		return "", err
	}
	var value string
	if err := json.Unmarshal(object[name], &value); err != nil || value == "" {
		return "", fmt.Errorf("missing or invalid string field %s", name)
	}
	return value, nil
}

func run(args []string, input io.Reader, output io.Writer) error {
	if len(args) == 0 {
		return errors.New("expected field, stream, staging or style-package")
	}
	switch args[0] {
	case "field":
		if len(args) < 2 || len(args) > 3 {
			return errors.New("field KEY [FILE]")
		}
		if len(args) == 3 {
			f, err := os.Open(args[2])
			if err != nil {
				return err
			}
			defer f.Close()
			input = f
		}
		value, err := field(input, args[1])
		if err != nil {
			return err
		}
		_, err = fmt.Fprintln(output, value)
		return err
	case "stream":
		if len(args) != 1 {
			return errors.New("stream takes JSON on stdin")
		}
		if err := streamReady(input); err != nil {
			return err
		}
		_, err := fmt.Fprintln(output, "ok")
		return err
	case "staging":
		if len(args) != 3 {
			return errors.New("staging SHA ASSET; HEALTH and MANIFEST environment required")
		}
		if err := stagingReady(os.Getenv("HEALTH"), os.Getenv("MANIFEST"), args[1], args[2]); err != nil {
			return err
		}
		_, err := fmt.Fprintln(output, "1")
		return err
	case "style-package":
		if len(args) != 2 {
			return errors.New("style-package FILE")
		}
		return patchStylePackage(args[1])
	default:
		return errors.New("unknown activation-check command")
	}
}

func main() {
	if err := run(os.Args[1:], os.Stdin, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "[activation-check]", err)
		os.Exit(1)
	}
}

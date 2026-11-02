package main

import (
	"errors"
	"io"
	"strings"
)

func streamReady(r io.Reader) error {
	var status struct {
		OK    bool `json:"ok"`
		Video struct {
			Fragments *float64 `json:"fragmentsSent"`
			FPS       *float64 `json:"remuxFps"`
			Age       *float64 `json:"lastChunkAgeMs"`
		} `json:"video"`
	}
	if err := decode(r, &status); err != nil {
		return err
	}
	v := status.Video
	if !status.OK || v.Fragments == nil || *v.Fragments <= 0 ||
		v.FPS == nil || *v.FPS < .25 || v.Age == nil || *v.Age < 0 || *v.Age > 24_000 {
		return errors.New("remux is not producing fresh fragments")
	}
	return nil
}

func stagingReady(healthJSON, manifestJSON, sha, asset string) error {
	var health struct {
		OK     bool     `json:"ok"`
		Asset  string   `json:"watchAssetVersion"`
		Issues []string `json:"issues"`
		Stream struct {
			Connected bool     `json:"connected"`
			Ready     bool     `json:"remuxInitReady"`
			Age       *float64 `json:"frameAgeMs"`
			FPS       *float64 `json:"remuxFragmentFps"`
		} `json:"stream"`
	}
	var manifest struct {
		SHA   string `json:"commitSha"`
		Asset string `json:"watchAssetVersion"`
	}
	if err := decode(strings.NewReader(healthJSON), &health); err != nil {
		return err
	}
	if err := decode(strings.NewReader(manifestJSON), &manifest); err != nil {
		return err
	}
	if sha == "" || asset == "" || manifest.SHA != sha || manifest.Asset != asset || health.Asset != asset {
		return errors.New("staging identity does not match candidate")
	}
	if !health.OK || !health.Stream.Connected || !health.Stream.Ready || len(health.Issues) != 0 {
		return errors.New("staging remux is unhealthy")
	}
	if health.Stream.Age == nil || *health.Stream.Age < 0 || *health.Stream.Age > 8_000 ||
		health.Stream.FPS == nil || *health.Stream.FPS < .25 {
		return errors.New("staging remux is not producing fresh fragments")
	}
	return nil
}

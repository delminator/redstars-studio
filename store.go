// Package studio holds what the shop and the site show about the app, read
// from three folders (format: redstars-core docs/APP_STORE.md):
//
//	visibility/  app.json — name, icon, colour, short description, public|private
//	settings/    pricing.json — price tiers, crowdfunding goals
//	             permissions.json — core data the app uses and why, what each role can do
//	pages/       project.md — the project page; funding.md — the funding page
//
// Edit those files, not code: the pod serves them at /ui/store and core's
// discovery puts them in the shop. The pod refuses to start, and
// store_test.go fails, when one of them is invalid.
package studio

import "embed"

//go:embed visibility settings pages
var Files embed.FS

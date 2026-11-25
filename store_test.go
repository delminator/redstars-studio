package studio

import (
	"testing"

	"github.com/delminator/redstars/backend/pkg/appstore"
)

// The shop declaration must be valid before it reaches a pod (which would
// refuse to start) — same validation as core's.
func TestStoreDeclarationIsValid(t *testing.T) {
	if _, err := appstore.Load(Files); err != nil {
		t.Fatal(err)
	}
}

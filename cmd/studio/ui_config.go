package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// handleUIConfig — GET /api/v1/studio/ui/config?org=<oid>
//
// The runtime, per-org config the host applies to your plugin's chrome.
// Every field is OPTIONAL — omit one to keep the AppPlugin default.
// The host re-fetches this on app mount + every 30 s.
//
// V1 returns static defaults. Once you have per-org overrides, look
// them up by the `org` query param.
func handleUIConfig(c *gin.Context) {
	org := c.Query("org")
	_ = org // use it once per-org overrides land in your DB

	c.JSON(http.StatusOK, gin.H{
		// Override the plugin's accent token for this org:
		// "accent_token": "c-info",

		// Override host-chrome theming for this org (same shape as
		// AppPlugin.theme — role or index bindings):
		// "theme": gin.H{"header": gin.H{"role": "info"}},

		// Override the chrome header label:
		// "header_label": gin.H{"fr": "Mon App", "en": "My App"},

		// Menu badge counts — surfaces a number next to a menu item.
		"badges": gin.H{},

		// Feature flags, read via useAppConfig().features in a slot.
		"features": []string{},
	})
}

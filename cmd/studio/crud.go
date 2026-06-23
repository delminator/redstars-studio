// GENERATED — generic CRUD helpers over core's org-DB API (the canonical pattern).
package main

import (
	"net/http"
	"os"
	"net/url"
	"strings"
	"time"

	"github.com/delminator/redstars/backend/pkg/coresdk"
	"github.com/gin-gonic/gin"
)

func reqCtx(c *gin.Context) coresdk.RequestContext {
	token := c.GetHeader("Authorization")
	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	return coresdk.RequestContext{AuthToken: token, OrgOID: c.GetHeader("X-Organization-OID")}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// filterableQuery maps plain ?status=/?type= params onto core's filter_<col>.
var filterableQuery = map[string]bool{"status": true, "type": true, "kind": true, "category": true, "parent_id": true}

func crudList(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		params := url.Values{}
		if l := c.Query("limit"); l != "" {
			params.Set("limit", l)
		}
		if o := c.Query("offset"); o != "" {
			params.Set("offset", o)
		}
		if s := c.Query("sort"); s != "" {
			params.Set("sort", s)
		}
		for k, v := range c.Request.URL.Query() {
			if strings.HasPrefix(k, "filter_") {
				params.Set(k, v[0])
			}
			if filterableQuery[k] {
				params.Set("filter_"+k, v[0])
			}
		}
		r, err := core.ListRows(reqCtx(c), table, params)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, r)
	}
}

func crudGet(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		r, err := core.GetRow(reqCtx(c), table, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, r)
	}
}

func crudCreate(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var data map[string]interface{}
		if err := c.ShouldBindJSON(&data); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
			return
		}
		id, err := core.InsertRow(reqCtx(c), table, data)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"id": id})
	}
}

func crudUpdate(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var data map[string]interface{}
		if err := c.ShouldBindJSON(&data); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
			return
		}
		if err := core.UpdateRow(reqCtx(c), table, c.Param("id"), data); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"updated": true})
	}
}

func crudDelete(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := core.DeleteRow(reqCtx(c), table, c.Param("id")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"deleted": true})
	}
}

func registerCRUD(g *gin.RouterGroup, path, table string) {
	g.GET(path, crudList(table))
	g.GET(path+"/:id", crudGet(table))
	g.POST(path, crudCreate(table))
	g.PUT(path+"/:id", crudUpdate(table))
	g.DELETE(path+"/:id", crudDelete(table))
}

// publishHandler marks a row published (status + date set server-side).
func publishHandler(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		data := map[string]interface{}{"status": "published", "published_at": time.Now().Format(time.RFC3339)}
		if err := core.UpdateRow(reqCtx(c), table, c.Param("id"), data); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"updated": true})
	}
}

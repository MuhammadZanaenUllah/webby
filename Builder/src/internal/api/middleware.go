package api

import (
	"net/http"
	"time"

	"webby-builder/internal/logging"
	"webby-builder/internal/models"

	"github.com/sirupsen/logrus"

	"github.com/gin-gonic/gin"
)

// ServerKeyAuth middleware validates the X-Server-Key header
func ServerKeyAuth(serverKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-Server-Key")
		if key != serverKey {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: "Invalid or missing server key",
			})
			return
		}
		c.Next()
	}
}

// RequestSizeLimit middleware limits the request body size
func RequestSizeLimit(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		}
		c.Next()
	}
}

// LoggerMiddleware logs requests
func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		logging.WithFields(logrus.Fields{
			"method":   c.Request.Method,
			"path":     path,
			"client":   c.ClientIP(),
			"status":   status,
			"duration": latency,
		}).Info("HTTP request")
	}
}

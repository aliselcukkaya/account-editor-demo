package middleware

import (
	"github.com/gin-gonic/gin"
)

// SecurityHeaders adds security headers to every response
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;")
		c.Next()
	}
}

// TrustedHosts implements the trusted hosts middleware
func TrustedHosts() gin.HandlerFunc {
	return func(c *gin.Context) {
		host := c.Request.Host

		// List of allowed hosts
		allowedHosts := []string{
			"localhost",
			"127.0.0.1",
		}

		allowed := false
		for _, allowedHost := range allowedHosts {
			if host == allowedHost || (allowedHost == "localhost" && (host == "localhost:8080" || host == "localhost:5173")) {
				allowed = true
				break
			}
		}

		if !allowed {
			c.AbortWithStatus(403) // Forbidden
			return
		}

		c.Next()
	}
}

// HandleForwardedHeaders handles x-forwarded headers
func HandleForwardedHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetHeader("X-Forwarded-Proto") != "" {
			// In Go, we can't directly modify the request scheme,
			// but we can use the header value in application logic if needed
			c.Set("scheme", c.GetHeader("X-Forwarded-Proto"))
		}
		c.Next()
	}
}

package middleware

import (
	"net/http"
	"strings"

	"github.com/aliselcukkaya/account-editor/internal/models"
	"github.com/aliselcukkaya/account-editor/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AuthRequired is a middleware that checks if the request has a valid JWT token
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header is required",
			})
			return
		}

		// Check if the Authorization header format is valid
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header format must be Bearer {token}",
			})
			return
		}

		// Verify the token
		tokenString := parts[1]
		claims, err := utils.VerifyToken(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid or expired token",
			})
			return
		}

		// Set username in context
		c.Set("username", claims.Username)
		c.Next()
	}
}

// GetCurrentUser retrieves the current user from the database based on the username in the token
func GetCurrentUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		username, exists := c.Get("username")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "User not authenticated",
			})
			return
		}

		var user models.User
		if err := db.Where("username = ?", username).First(&user).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "User not found",
			})
			return
		}

		if !user.IsActive {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "User is inactive",
			})
			return
		}

		c.Set("user", user)
		c.Next()
	}
}

// AdminRequired is a middleware that checks if the user is an admin
func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get("user")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "User not authenticated",
			})
			return
		}

		u, ok := user.(models.User)
		if !ok {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Internal server error",
			})
			return
		}

		if !u.IsAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Admin access required",
			})
			return
		}

		c.Next()
	}
}

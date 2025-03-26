package auth

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/aliselcukkaya/account-editor/internal/database"
	"github.com/aliselcukkaya/account-editor/internal/models"
	"github.com/aliselcukkaya/account-editor/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type UserStatus struct {
	IsActive bool `json:"is_active"`
	IsAdmin  bool `json:"is_admin"`
}

type TokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Username    string `json:"username"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type CreateUserRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	IsAdmin  bool   `json:"is_admin"`
}

type UpdateUserRequest struct {
	Password string `json:"password"`
	IsAdmin  bool   `json:"is_admin"`
	IsActive bool   `json:"is_active"`
}

// GetUserStatus returns the status of the currently authenticated user
func GetUserStatus(c *gin.Context) {
	// User is already set by the GetCurrentUser middleware
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	u, ok := user.(models.User)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Invalid user data",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"is_active":  u.IsActive,
		"is_admin":   u.IsAdmin,
		"created_at": u.CreatedAt,
	})
}

// Login authenticates a user and returns a JWT token
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := database.GetDB()

	user, err := utils.AuthenticateUser(db, req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	if !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Account is inactive. Please contact administrator."})
		return
	}

	// Update last login time
	now := time.Now()
	user.LastLoginAt = &now
	if err := db.Save(&user).Error; err != nil {
		// Log the error but don't fail the login
		fmt.Printf("Failed to update last login time: %v\n", err)
	}

	token, err := utils.CreateAccessToken(user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	c.JSON(http.StatusOK, TokenResponse{
		AccessToken: token,
		TokenType:   "bearer",
		Username:    user.Username,
	})
}

// CreateUser creates a new user (admin only)
func CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := database.GetDB()

	// Check if user already exists
	var existingUser models.User
	result := db.Where("username = ?", req.Username).First(&existingUser)
	if result.Error == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username already registered"})
		return
	} else if result.Error != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Create new user
	user := models.User{
		Username:       req.Username,
		HashedPassword: hashedPassword,
		IsAdmin:        req.IsAdmin,
	}

	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":       user.ID,
		"username": user.Username,
		"is_admin": user.IsAdmin,
		"message":  "User created successfully",
	})
}

// GetUsers lists all users (admin only)
func GetUsers(c *gin.Context) {
	db := database.GetDB()

	var users []models.User
	if err := db.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve users"})
		return
	}

	// Map to response format without exposing sensitive data
	var response []gin.H
	for _, user := range users {
		userData := gin.H{
			"id":            user.ID,
			"username":      user.Username,
			"is_admin":      user.IsAdmin,
			"is_active":     user.IsActive,
			"created_at":    user.CreatedAt,
			"last_login_at": user.LastLoginAt,
		}

		response = append(response, userData)
	}

	c.JSON(http.StatusOK, response)
}

// UpdateUser updates a user (admin only)
func UpdateUser(c *gin.Context) {
	// Get user ID from URL
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := database.GetDB()

	// Find user by ID
	var user models.User
	if err := db.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	// Update user fields
	if req.Password != "" {
		hashedPassword, err := utils.HashPassword(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		user.HashedPassword = hashedPassword
	}
	user.IsAdmin = req.IsAdmin
	user.IsActive = req.IsActive

	// Save changes
	if err := db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":        user.ID,
		"username":  user.Username,
		"is_admin":  user.IsAdmin,
		"is_active": user.IsActive,
		"message":   "User updated successfully",
	})
}

// DeleteUser deletes a user (admin only)
func DeleteUser(c *gin.Context) {
	// Get user ID from URL
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	db := database.GetDB()

	// Find user by ID
	var user models.User
	if err := db.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	// Delete user
	if err := db.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User deleted successfully",
	})
}

// SetupRoutes configures the auth routes
func SetupRoutes(router *gin.RouterGroup) {
	router.POST("/token", Login)
}

// SetupProtectedRoutes configures the protected auth routes that require authentication
func SetupProtectedRoutes(router *gin.RouterGroup) {
	router.GET("/status", GetUserStatus)
}

// SetupAdminRoutes configures the admin auth routes
func SetupAdminRoutes(router *gin.RouterGroup) {
	router.POST("/users", CreateUser)
	router.GET("/users", GetUsers)
	router.PUT("/users/:id", UpdateUser)
	router.DELETE("/users/:id", DeleteUser)
}

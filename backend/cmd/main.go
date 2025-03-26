package main

import (
	"log"

	"github.com/aliselcukkaya/account-editor/internal/auth"
	"github.com/aliselcukkaya/account-editor/internal/automation"
	"github.com/aliselcukkaya/account-editor/internal/database"
	"github.com/aliselcukkaya/account-editor/internal/middleware"
	"github.com/aliselcukkaya/account-editor/internal/models"
	"github.com/aliselcukkaya/account-editor/pkg/utils"
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
	"gorm.io/gorm"
)

// Creates a default admin user if no users exist in the database
func createDefaultAdminUser(db *gorm.DB) {
	var count int64
	db.Model(&models.User{}).Count(&count)

	if count == 0 {
		hashedPassword, err := utils.HashPassword("admin")
		if err != nil {
			log.Fatal("Failed to hash admin password:", err)
		}

		adminUser := models.User{
			Username:       "admin",
			HashedPassword: hashedPassword,
			IsActive:       true,
			IsAdmin:        true,
		}

		if err := db.Create(&adminUser).Error; err != nil {
			log.Fatal("Failed to create default admin user:", err)
		}

		log.Println("Default admin user created. Username: admin, Password: admin")
	}
}

func main() {
	// Initialize database
	database.Initialize()

	// Create default admin user
	createDefaultAdminUser(database.GetDB())

	// Create a new gin router
	r := gin.Default()

	// Create rate limiter - 10 requests per second with burst of 20
	// Prevent bots for brute force attack
	limiter := middleware.NewIPRateLimiter(rate.Limit(10), 20)

	// Add middleware
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.RateLimiterMiddleware(limiter))
	r.Use(middleware.CORSMiddleware())

	// Root route
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message":  "Welcome to Account Editor API",
			"docs_url": "/docs",
			"version":  "1.0.0",
		})
	})

	// Public auth routes (login)
	authGroup := r.Group("/auth")
	{
		auth.SetupRoutes(authGroup)
	}

	// Protected auth routes (status)
	protectedAuthGroup := r.Group("/auth")
	protectedAuthGroup.Use(middleware.AuthRequired(), middleware.GetCurrentUser(database.GetDB()))
	{
		auth.SetupProtectedRoutes(protectedAuthGroup)
	}

	// Automation routes
	automationGroup := r.Group("/automation")
	automationGroup.Use(middleware.AuthRequired(), middleware.GetCurrentUser(database.GetDB()))
	{
		automation.SetupRoutes(automationGroup)
	}

	// Admin routes
	adminGroup := r.Group("/admin")
	adminGroup.Use(middleware.AuthRequired(), middleware.GetCurrentUser(database.GetDB()), middleware.AdminRequired())
	{
		auth.SetupAdminRoutes(adminGroup)
	}

	// Start the server
	log.Println("Starting server on :8080")
	log.Println("Access the API at http://localhost:8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Error starting server: ", err)
	}
}

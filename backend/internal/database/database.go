package database

import (
	"log"
	"os"

	"github.com/aliselcukkaya/account-editor/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	// DB is the global database connection
	DB *gorm.DB
)

// Initialize sets up the database connection and creates tables
func Initialize() {
	var err error

	// Configure GORM logger
	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			LogLevel: logger.Info,
		},
	)

	// Connect to SQLite database
	DB, err = gorm.Open(sqlite.Open("sql_app.db"), &gorm.Config{
		Logger: newLogger,
	})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto-migrate the schema
	err = DB.AutoMigrate(
		&models.User{},
		&models.AutomationTask{},
		&models.UserSettings{},
	)
	if err != nil {
		log.Fatal("Failed to auto-migrate schema:", err)
	}

	log.Println("Database initialized successfully")
}

// GetDB returns the database connection
func GetDB() *gorm.DB {
	return DB
}

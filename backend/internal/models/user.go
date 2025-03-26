package models

import (
	"time"
)

// UserStatus represents the status of a user
type UserStatus string

const (
	// UserStatusActive indicates an active user
	UserStatusActive UserStatus = "active"
)

// User represents a user in the system
type User struct {
	ID              int              `gorm:"primaryKey;autoIncrement"`
	Username        string           `gorm:"unique;index"`
	HashedPassword  string           `gorm:"column:hashed_password"`
	IsActive        bool             `gorm:"default:true"`
	IsAdmin         bool             `gorm:"default:false"`
	CreatedAt       time.Time        `gorm:"autoCreateTime"`
	UpdatedAt       time.Time        `gorm:"autoUpdateTime"`
	LastLoginAt     *time.Time       `gorm:"column:last_login_at"`
	AutomationTasks []AutomationTask `gorm:"foreignKey:UserID"`
	Settings        *UserSettings    `gorm:"foreignKey:UserID"`
}

// TableName specifies the table name for User
func (User) TableName() string {
	return "users"
}

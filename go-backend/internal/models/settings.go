package models

import (
	"time"
)

// UserSettings represents the settings for a user's automation tasks
type UserSettings struct {
	ID         int       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     int       `gorm:"unique;index" json:"user_id"`
	WebsiteURL string    `gorm:"column:website_url" json:"website_url"`
	APIKey     string    `gorm:"column:api_key" json:"api_key"`
	AuthUser   string    `gorm:"column:auth_user" json:"auth_user"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt  time.Time `gorm:"autoUpdateTime" json:"updated_at"`
	User       User      `gorm:"foreignKey:UserID" json:"-"`
}

// TableName specifies the database table name
func (UserSettings) TableName() string {
	return "user_settings"
}

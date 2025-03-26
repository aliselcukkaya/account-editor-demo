package models

import (
	"encoding/json"
	"time"
)

type AutomationTask struct {
	ID            int        `gorm:"primaryKey;autoIncrement"`
	UserID        int        `gorm:"index"`
	Name          string     `gorm:"column:name"`
	TargetWebsite string     `gorm:"column:target_website"`
	Status        string     `gorm:"column:status"` // pending, running, completed, failed
	Result        JSON       `gorm:"type:json"`
	CreatedAt     time.Time  `gorm:"autoCreateTime"`
	UpdatedAt     time.Time  `gorm:"autoUpdateTime"`
	CompletedAt   *time.Time `gorm:"column:completed_at"`
	User          User       `gorm:"foreignKey:UserID"`
}

func (AutomationTask) TableName() string {
	return "automation_tasks"
}

type JSON json.RawMessage

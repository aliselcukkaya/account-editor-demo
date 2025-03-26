package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
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

func (j *JSON) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}

	result := json.RawMessage{}
	err := json.Unmarshal(bytes, &result)
	*j = JSON(result)
	return err
}

func (j JSON) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return json.RawMessage(j).MarshalJSON()
}

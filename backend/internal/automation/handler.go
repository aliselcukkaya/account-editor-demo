package automation

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"log"

	"github.com/aliselcukkaya/account-editor/internal/database"
	"github.com/aliselcukkaya/account-editor/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TaskRequest struct {
	Name          string `json:"name" binding:"required"`
	TargetWebsite string `json:"target_website" binding:"required"`
	Username      string `json:"username,omitempty"`
	Password      string `json:"password,omitempty"`
	Package       int    `json:"package"`
}

type SettingsRequest struct {
	WebsiteURL string `json:"website_url" binding:"required"`
	APIKey     string `json:"api_key" binding:"required"`
	AuthUser   string `json:"auth_user" binding:"required"`
}

func CreateTask(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req TaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("Error binding JSON: %v", err)

		// Create a more user-friendly error message
		errorMsg := "Invalid request format"

		// Check if it's a validation error for TargetWebsite
		if strings.Contains(err.Error(), "TargetWebsite") && strings.Contains(err.Error(), "required") {
			errorMsg = "Panel URL is not configured. Please go to Settings and configure your Panel URL first."
		}

		c.JSON(http.StatusBadRequest, gin.H{"error": errorMsg})
		return
	}

	u, ok := user.(models.User)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user data"})
		return
	}

	// Get settings from database
	var settings models.UserSettings
	db := database.GetDB()
	if err := db.Where("user_id = ?", u.ID).First(&settings).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Settings not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Create API client
	apiClient := NewAPIClient(settings.WebsiteURL, settings.APIKey, settings.AuthUser)

	// Create task record
	task := models.AutomationTask{
		UserID:        u.ID,
		Name:          req.Name,
		Status:        "pending",
		TargetWebsite: req.TargetWebsite,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := db.Create(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	// Start task execution in background
	go executeTask(task.ID, req, apiClient)

	c.JSON(http.StatusCreated, task)
}

// executeTask executes the automation task
func executeTask(taskID int, req TaskRequest, apiClient *APIClient) {
	// Recover from any panics
	defer func() {
		if r := recover(); r != nil {
			log.Printf("PANIC in executeTask for task ID %d: %v", taskID, r)

			// Try to update the task status in case of panic
			db := database.GetDB()
			if db != nil {
				var task models.AutomationTask
				if err := db.First(&task, taskID).Error; err == nil {
					task.Status = "failed"
					errorData := map[string]interface{}{
						"success": false,
						"error":   "Internal server error: task execution panicked",
					}
					resultJSON, _ := json.Marshal(errorData)
					task.Result = models.JSON(resultJSON)
					now := time.Now()
					task.CompletedAt = &now
					db.Save(&task)
				}
			}
		}
	}()

	log.Printf("Executing task ID: %d, name: %s", taskID, req.Name)

	db := database.GetDB()
	if db == nil {
		log.Printf("Database connection is nil in executeTask for task ID %d", taskID)
		return
	}

	var task models.AutomationTask

	if err := db.First(&task, taskID).Error; err != nil {
		log.Printf("Failed to find task ID %d: %v", taskID, err)
		return
	}

	// Generate RID
	rid := uuid.New().String()

	// Check if we're in simulation mode
	isSimulation := apiClient.IsSimulationMode()
	log.Printf("Task ID %d is in simulation mode: %v", taskID, isSimulation)

	// Initialize a timestamp that will be used for the completedAt field
	now := time.Now()

	switch task.Name {
	case "create_account":
		var response *CreateAccountResponse
		var err error

		// Prepare API request
		apiReq := CreateAccountRequest{
			Username: req.Username,
			Password: req.Password,
			Package:  req.Package,
			RID:      rid,
		}

		// Execute API call (real or simulated)
		if isSimulation {
			response, err = apiClient.SimulateCreateAccount(apiReq)
		} else {
			response, err = apiClient.CreateAccount(apiReq)
		}

		if err != nil {
			log.Printf("Task ID %d failed: %v", taskID, err)
			// Update task status to failed
			task.Status = "failed"

			// Sanitize the error message in case it contains HTML
			errorMessage := sanitizeErrorMessage(err.Error())

			// Create error response using proper JSON marshaling
			errorData := map[string]interface{}{
				"success": false,
				"error":   errorMessage,
			}
			resultJSON, jsonErr := json.Marshal(errorData)
			if jsonErr != nil {
				log.Printf("Failed to marshal error data: %v", jsonErr)
				resultJSON = []byte(`{"success":false,"error":"Failed to serialize error message"}`)
			}

			task.Result = models.JSON(resultJSON)
			task.CompletedAt = &now
			if saveErr := db.Save(&task).Error; saveErr != nil {
				log.Printf("Failed to save task ID %d: %v", taskID, saveErr)
			}
			return
		}

		// Update task status to completed
		task.Status = "completed"
		task.CompletedAt = &now

		// Format result
		result := map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"line_id":            response.LineID,
				"username":           req.Username,
				"password":           req.Password,
				"expire_at":          response.ExpireAt,
				"transaction_amount": response.TransactionAmount,
				"rid":                response.RID,
			},
		}

		resultJSON, jsonErr := json.Marshal(result)
		if jsonErr != nil {
			log.Printf("Failed to marshal success result for task ID %d: %v", taskID, jsonErr)
			task.Status = "failed"
			errorData := map[string]interface{}{
				"success": false,
				"error":   "Failed to serialize result data",
			}
			resultJSON, _ = json.Marshal(errorData)
		}

		task.Result = models.JSON(resultJSON)
		if saveErr := db.Save(&task).Error; saveErr != nil {
			log.Printf("Failed to save task ID %d: %v", taskID, saveErr)
		}

	case "find_account":
		var lines []Line
		var err error

		// Execute API call (real or simulated)
		if isSimulation {
			lines, err = apiClient.SimulateFindAccount(req.Username)
		} else {
			lines, err = apiClient.FindAccount(req.Username)
		}

		if err != nil {
			log.Printf("Task ID %d failed: %v", taskID, err)
			// Update task status to failed
			task.Status = "failed"

			// Sanitize the error message in case it contains HTML
			errorMessage := sanitizeErrorMessage(err.Error())

			// Create error response using proper JSON marshaling
			errorData := map[string]interface{}{
				"success": false,
				"error":   errorMessage,
			}
			resultJSON, jsonErr := json.Marshal(errorData)
			if jsonErr != nil {
				log.Printf("Failed to marshal error data: %v", jsonErr)
				resultJSON = []byte(`{"success":false,"error":"Failed to serialize error message"}`)
			}

			task.Result = models.JSON(resultJSON)
			task.CompletedAt = &now
			if saveErr := db.Save(&task).Error; saveErr != nil {
				log.Printf("Failed to save task ID %d: %v", taskID, saveErr)
			}
			return
		}

		// Update task status to completed
		task.Status = "completed"
		task.CompletedAt = &now

		// Format result
		result := map[string]interface{}{
			"success": true,
			"data":    lines,
		}

		resultJSON, jsonErr := json.Marshal(result)
		if jsonErr != nil {
			log.Printf("Failed to marshal success result for task ID %d: %v", taskID, jsonErr)
			task.Status = "failed"
			errorData := map[string]interface{}{
				"success": false,
				"error":   "Failed to serialize result data",
			}
			resultJSON, _ = json.Marshal(errorData)
		}

		task.Result = models.JSON(resultJSON)
		if saveErr := db.Save(&task).Error; saveErr != nil {
			log.Printf("Failed to save task ID %d: %v", taskID, saveErr)
		}

	case "extend_package":
		var lines []Line
		var err error
		var response *ExtendPackageResponse

		// First find the account to get the line_id (real or simulated)
		if isSimulation {
			lines, err = apiClient.SimulateFindAccount(req.Username)
		} else {
			lines, err = apiClient.FindAccount(req.Username)
		}

		if err != nil {
			log.Printf("Task ID %d failed to find account: %v", taskID, err)
			// Update task status to failed
			task.Status = "failed"

			// Sanitize the error message in case it contains HTML
			errorMessage := sanitizeErrorMessage(err.Error())

			// Create error response using proper JSON marshaling
			errorData := map[string]interface{}{
				"success": false,
				"error":   errorMessage,
			}
			resultJSON, jsonErr := json.Marshal(errorData)
			if jsonErr != nil {
				log.Printf("Failed to marshal error data: %v", jsonErr)
				resultJSON = []byte(`{"success":false,"error":"Failed to serialize error message"}`)
			}

			task.Result = models.JSON(resultJSON)
			task.CompletedAt = &now
			if saveErr := db.Save(&task).Error; saveErr != nil {
				log.Printf("Failed to save task ID %d: %v", taskID, saveErr)
			}
			return
		}

		if len(lines) == 0 {
			log.Printf("Task ID %d failed: no accounts found for username %s", taskID, req.Username)
			// No accounts found
			task.Status = "failed"

			// Sanitize the error message in case it contains HTML
			errorMessage := sanitizeErrorMessage("No accounts found with the provided username")

			// Create error response using proper JSON marshaling
			errorData := map[string]interface{}{
				"success": false,
				"error":   errorMessage,
			}
			resultJSON, _ := json.Marshal(errorData)
			task.Result = models.JSON(resultJSON)
			task.CompletedAt = &now
			if saveErr := db.Save(&task).Error; saveErr != nil {
				log.Printf("Failed to save task ID %d: %v", taskID, saveErr)
			}
			return
		}

		// Use the first account found
		line := lines[0]

		// Prepare API request for extending the package
		extendReq := ExtendPackageRequest{
			Package: req.Package,
			RID:     rid,
		}

		// Execute API call to extend the package (real or simulated)
		if isSimulation {
			response, err = apiClient.SimulateExtendPackage(line.LineID, extendReq)
		} else {
			response, err = apiClient.ExtendPackage(line.LineID, extendReq)
		}

		if err != nil {
			log.Printf("Task ID %d failed to extend package: %v", taskID, err)
			// Update task status to failed
			task.Status = "failed"

			// Sanitize the error message in case it contains HTML
			errorMessage := sanitizeErrorMessage(err.Error())

			// Create error response using proper JSON marshaling
			errorData := map[string]interface{}{
				"success": false,
				"error":   errorMessage,
			}
			resultJSON, jsonErr := json.Marshal(errorData)
			if jsonErr != nil {
				log.Printf("Failed to marshal error data: %v", jsonErr)
				resultJSON = []byte(`{"success":false,"error":"Failed to serialize error message"}`)
			}

			task.Result = models.JSON(resultJSON)
			task.CompletedAt = &now
			if saveErr := db.Save(&task).Error; saveErr != nil {
				log.Printf("Failed to save task ID %d: %v", taskID, saveErr)
			}
			return
		}

		// Update task status to completed
		task.Status = "completed"
		task.CompletedAt = &now

		// Format result
		result := map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"line_id":            response.LineID,
				"username":           line.Username,
				"password":           line.Password,
				"expire_at":          response.ExpireAt,
				"transaction_amount": response.TransactionAmount,
				"rid":                response.RID,
			},
		}

		resultJSON, jsonErr := json.Marshal(result)
		if jsonErr != nil {
			log.Printf("Failed to marshal success result for task ID %d: %v", taskID, jsonErr)
			task.Status = "failed"
			errorData := map[string]interface{}{
				"success": false,
				"error":   "Failed to serialize result data",
			}
			resultJSON, _ = json.Marshal(errorData)
		}

		task.Result = models.JSON(resultJSON)
		if saveErr := db.Save(&task).Error; saveErr != nil {
			log.Printf("Failed to save task ID %d: %v", taskID, saveErr)
		}
	}

	log.Printf("Task ID %d execution completed successfully", taskID)
}

// GetUserTasks returns all tasks for the current user
func GetUserTasks(c *gin.Context) {
	log.Printf("GetUserTasks called")

	user, exists := c.Get("user")
	if !exists {
		log.Printf("User not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	u, ok := user.(models.User)
	if !ok {
		log.Printf("Failed to convert user to models.User: %+v", user)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user data"})
		return
	}

	log.Printf("Fetching tasks for user ID: %d", u.ID)

	var tasks []models.AutomationTask
	db := database.GetDB()

	if err := db.Where("user_id = ?", u.ID).Find(&tasks).Error; err != nil {
		log.Printf("Database error when fetching tasks: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve tasks"})
		return
	}

	log.Printf("Found %d tasks for user ID %d", len(tasks), u.ID)
	c.JSON(http.StatusOK, tasks)
}

// GetTask returns a specific task
func GetTask(c *gin.Context) {
	// Recover from any panics
	defer func() {
		if r := recover(); r != nil {
			log.Printf("PANIC in GetTask: %v", r)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		}
	}()

	id := c.Param("id")
	log.Printf("GetTask called with ID: %s", id)

	if id == "" {
		log.Printf("Empty task ID provided")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Task ID is required"})
		return
	}

	user, exists := c.Get("user")
	if !exists {
		log.Printf("User not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	u, ok := user.(models.User)
	if !ok {
		log.Printf("Failed to convert user to models.User: %+v", user)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user data"})
		return
	}

	log.Printf("Fetching task ID %s for user ID: %d", id, u.ID)

	db := database.GetDB()
	if db == nil {
		log.Printf("Database connection is nil")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection error"})
		return
	}

	// Try a direct query to get the raw data
	var rawResult map[string]interface{}
	rawQuery := "SELECT * FROM automation_tasks WHERE id = ? AND user_id = ?"
	if err := db.Raw(rawQuery, id, u.ID).Scan(&rawResult).Error; err != nil {
		log.Printf("Raw query error: %v", err)
	} else {
		if result, ok := rawResult["result"]; ok {
			// Log a preview of the result for debugging
			resultStr := fmt.Sprintf("%v", result)
			maxLen := 200
			jsonPreview := resultStr
			if len(resultStr) > maxLen {
				jsonPreview = resultStr[:maxLen] + "..."
			}
			log.Printf("Raw result data preview: %s", jsonPreview)
		}
	}

	// Query for the task but handle JSON errors separately
	rows, err := db.Raw("SELECT id, user_id, name, target_website, status, created_at, updated_at, completed_at FROM automation_tasks WHERE id = ? AND user_id = ?", id, u.ID).Rows()
	if err != nil {
		log.Printf("Error querying task: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}
	defer rows.Close()

	if !rows.Next() {
		log.Printf("Task ID %s not found for user ID %d", id, u.ID)
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	var task models.AutomationTask

	// Scan basic fields
	scanErr := rows.Scan(
		&task.ID,
		&task.UserID,
		&task.Name,
		&task.TargetWebsite,
		&task.Status,
		&task.CreatedAt,
		&task.UpdatedAt,
		&task.CompletedAt,
	)

	if scanErr != nil {
		log.Printf("Error scanning task: %v", scanErr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error reading task data: " + scanErr.Error()})
		return
	}

	// Get the result field separately and handle any errors
	var resultString sql.NullString
	resultErr := db.Raw("SELECT result FROM automation_tasks WHERE id = ? AND user_id = ?", id, u.ID).Scan(&resultString).Error

	if resultErr != nil {
		log.Printf("Error fetching result field: %v", resultErr)
		// Set a default value to avoid null result
		task.Result = models.JSON([]byte(`{"success":false,"error":"Unable to read result data"}`))
	} else if resultString.Valid {
		// Check if the JSON is valid
		var js json.RawMessage
		if json.Unmarshal([]byte(resultString.String), &js) == nil {
			task.Result = models.JSON(js)
		} else {
			log.Printf("Invalid JSON in result field: %s", resultString.String)
			// Use a valid JSON if the stored JSON is invalid
			task.Result = models.JSON([]byte(`{"success":false,"error":"Invalid result data format"}`))
		}
	} else {
		// Set empty valid JSON if null
		task.Result = models.JSON([]byte(`{"success":false,"data":{}}`))
	}

	log.Printf("Found task ID %s for user ID %d with status %s", id, u.ID, task.Status)

	// Prepare response data
	responseData := map[string]interface{}{
		"id":             task.ID,
		"user_id":        task.UserID,
		"name":           task.Name,
		"target_website": task.TargetWebsite,
		"status":         task.Status,
		"created_at":     task.CreatedAt,
		"updated_at":     task.UpdatedAt,
		"completed_at":   task.CompletedAt,
	}

	// Try to convert the result to a map for the response
	var resultData interface{}
	resultBytes := []byte(task.Result)
	if len(resultBytes) > 0 {
		if err := json.Unmarshal(resultBytes, &resultData); err == nil {
			// Success! Include the parsed result directly
			responseData["result"] = resultData
		} else {
			log.Printf("Error unmarshaling result for response: %v", err)
			// Fallback to a simple success/error structure
			responseData["result"] = map[string]interface{}{
				"success": false,
				"error":   "Failed to parse task result data",
			}
		}
	} else {
		// Empty result becomes an empty object
		responseData["result"] = map[string]interface{}{
			"success": false,
			"data":    map[string]interface{}{},
		}
	}

	c.JSON(http.StatusOK, responseData)
}

// UpdateSettings updates the user's automation settings
func UpdateSettings(c *gin.Context) {
	var req SettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, _ := c.Get("user")
	u := user.(models.User)

	db := database.GetDB()

	// Check if settings already exist
	var settings models.UserSettings
	result := db.Where("user_id = ?", u.ID).First(&settings)

	if result.Error != nil {
		// Create new settings
		settings = models.UserSettings{
			UserID:     u.ID,
			WebsiteURL: req.WebsiteURL,
			APIKey:     req.APIKey,
			AuthUser:   req.AuthUser,
		}
		if err := db.Create(&settings).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create settings"})
			return
		}
	} else {
		// Update existing settings
		settings.WebsiteURL = req.WebsiteURL
		settings.APIKey = req.APIKey
		settings.AuthUser = req.AuthUser

		if err := db.Save(&settings).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Settings updated successfully"})
}

// GetSettings returns the user's automation settings
func GetSettings(c *gin.Context) {
	user, _ := c.Get("user")
	u := user.(models.User)

	var settings models.UserSettings
	db := database.GetDB()

	result := db.Where("user_id = ?", u.ID).First(&settings)
	if result.Error != nil {
		c.JSON(http.StatusOK, gin.H{
			"website_url": "",
			"api_key":     "",
			"auth_user":   "",
		}) // Return empty object if no settings found
		return
	}

	// Format the response to match the expected structure in the frontend
	c.JSON(http.StatusOK, gin.H{
		"website_url": settings.WebsiteURL,
		"api_key":     settings.APIKey,
		"auth_user":   settings.AuthUser,
		"created_at":  settings.CreatedAt,
		"updated_at":  settings.UpdatedAt,
	})
}

// SetupRoutes configures the automation routes
func SetupRoutes(router *gin.RouterGroup) {
	router.POST("/tasks", CreateTask)
	router.GET("/tasks", GetUserTasks)
	router.GET("/tasks/:id", GetTask)
	router.PUT("/settings", UpdateSettings)
	router.GET("/settings", GetSettings)
}

// Helper function to check if a string contains HTML
func containsHTML(str string) bool {
	return strings.Contains(str, "<!DOCTYPE") ||
		strings.Contains(str, "<html") ||
		strings.Contains(str, "<body") ||
		strings.Contains(str, "<head") ||
		strings.Contains(str, "<title")
}

// Helper to sanitize error messages that might contain HTML
func sanitizeErrorMessage(errMsg string) string {
	if containsHTML(errMsg) {
		return "Connection error: The external service URL appears to be incorrect or not responding properly."
	}
	return errMsg
}

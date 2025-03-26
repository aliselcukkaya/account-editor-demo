package automation

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type APIClient struct {
	BaseURL    string
	APIKey     string
	AuthUser   string
	HTTPClient *http.Client
}

type CreateAccountRequest struct {
	Username      string `json:"username,omitempty"`
	Password      string `json:"password,omitempty"`
	Package       int    `json:"package"`
	ResellerNotes string `json:"reseller_notes,omitempty"`
	Bouquets      []int  `json:"bouquets,omitempty"`
	RID           string `json:"rid"`
}

type CreateAccountResponse struct {
	LineID            string    `json:"line_id"`
	ExpireAt          time.Time `json:"expire_at"`
	TransactionAmount float64   `json:"transaction_amount"`
	RID               string    `json:"rid"`
}

type ExtendPackageRequest struct {
	Package int    `json:"package"`
	RID     string `json:"rid"`
}

type ExtendPackageResponse struct {
	LineID            string    `json:"line_id"`
	ExpireAt          time.Time `json:"expire_at"`
	TransactionAmount float64   `json:"transaction_amount"`
	RID               string    `json:"rid"`
}

type Line struct {
	LineID         string    `json:"line_id"`
	Username       string    `json:"username"`
	Password       string    `json:"password"`
	MacAddr        string    `json:"mac_addr,omitempty"`
	Owner          string    `json:"owner"`
	Type           string    `json:"type"`
	ExpireAt       time.Time `json:"expire_at"`
	IsEnabled      bool      `json:"is_enabled"`
	IsRestreamer   bool      `json:"is_restreamer"`
	IsTrial        bool      `json:"is_trial"`
	PackageID      int       `json:"package_id,omitempty"`
	Bouquets       []int     `json:"bouquets"`
	MaxConnections int       `json:"max_connections"`
	ResellerNotes  string    `json:"reseller_notes,omitempty"`
}

func NewAPIClient(baseURL, apiKey, authUser string) *APIClient {
	// Initialize random seed for simulations
	rand.Seed(time.Now().UnixNano())

	return &APIClient{
		BaseURL:    baseURL,
		APIKey:     apiKey,
		AuthUser:   authUser,
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// isHTMLResponse checks if the response body contains HTML content
func isHTMLResponse(body []byte) bool {
	bodyStr := string(body)
	return strings.Contains(bodyStr, "<!DOCTYPE") ||
		strings.Contains(bodyStr, "<html") ||
		strings.Contains(bodyStr, "<body") ||
		strings.Contains(bodyStr, "<head") ||
		strings.Contains(bodyStr, "<title")
}

// formatConnectionError creates a user-friendly error message for connection issues
func formatConnectionError(url string, status int) string {
	if status == 404 {
		return "The panel URL is incorrect or the service could not be found. Please check your settings."
	} else if status >= 500 {
		return "The external service is currently unavailable. Please try again later."
	} else {
		return "Could not connect to the panel. Please verify your panel URL and try again."
	}
}

// Update error handling in CreateAccount method
func (c *APIClient) CreateAccount(req CreateAccountRequest) (*CreateAccountResponse, error) {
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request: %v", err)
	}

	httpReq, err := http.NewRequest("POST", fmt.Sprintf("%s/ext/line/create", c.BaseURL), bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Api-Key", c.APIKey)
	httpReq.Header.Set("X-Auth-User", c.AuthUser)

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("error making request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errorResp struct {
			Error string `json:"error"`
			RID   string `json:"rid"`
		}
		bodyBytes, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			return nil, fmt.Errorf("error reading error response: %v", readErr)
		}

		// Check if response is HTML
		if isHTMLResponse(bodyBytes) {
			return nil, fmt.Errorf("connection error: %s", formatConnectionError(c.BaseURL, resp.StatusCode))
		}

		// Try to decode JSON if it looks like JSON
		if len(bodyBytes) > 0 && bodyBytes[0] == '{' {
			if err := json.Unmarshal(bodyBytes, &errorResp); err != nil {
				return nil, fmt.Errorf("error response (status %d): %s", resp.StatusCode, string(bodyBytes))
			}
			return nil, fmt.Errorf("API error: %s (RID: %s)", errorResp.Error, errorResp.RID)
		}

		return nil, fmt.Errorf("unexpected response (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var response CreateAccountResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &response, nil
}

func (c *APIClient) FindAccount(username string) ([]Line, error) {
	httpReq, err := http.NewRequest("GET", fmt.Sprintf("%s/ext/lines?username=%s", c.BaseURL, username), nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	httpReq.Header.Set("X-Api-Key", c.APIKey)
	httpReq.Header.Set("X-Auth-User", c.AuthUser)

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("error making request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errorResp struct {
			Error string `json:"error"`
			RID   string `json:"rid"`
		}
		bodyBytes, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			return nil, fmt.Errorf("error reading error response: %v", readErr)
		}

		// Check if response is HTML
		if isHTMLResponse(bodyBytes) {
			return nil, fmt.Errorf("connection error: %s", formatConnectionError(c.BaseURL, resp.StatusCode))
		}

		// Try to decode JSON if it looks like JSON
		if len(bodyBytes) > 0 && bodyBytes[0] == '{' {
			if err := json.Unmarshal(bodyBytes, &errorResp); err != nil {
				return nil, fmt.Errorf("error response (status %d): %s", resp.StatusCode, string(bodyBytes))
			}
			return nil, fmt.Errorf("API error: %s (RID: %s)", errorResp.Error, errorResp.RID)
		}

		return nil, fmt.Errorf("unexpected response (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var lines []Line
	if err := json.NewDecoder(resp.Body).Decode(&lines); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return lines, nil
}

func (c *APIClient) ExtendPackage(lineID string, req ExtendPackageRequest) (*ExtendPackageResponse, error) {
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request: %v", err)
	}

	httpReq, err := http.NewRequest("POST", fmt.Sprintf("%s/ext/line/%s/renew", c.BaseURL, lineID), bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Api-Key", c.APIKey)
	httpReq.Header.Set("X-Auth-User", c.AuthUser)

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("error making request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errorResp struct {
			Error string `json:"error"`
			RID   string `json:"rid"`
		}
		bodyBytes, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			return nil, fmt.Errorf("error reading error response: %v", readErr)
		}

		// Check if response is HTML
		if isHTMLResponse(bodyBytes) {
			return nil, fmt.Errorf("connection error: %s", formatConnectionError(c.BaseURL, resp.StatusCode))
		}

		// Try to decode JSON if it looks like JSON
		if len(bodyBytes) > 0 && bodyBytes[0] == '{' {
			if err := json.Unmarshal(bodyBytes, &errorResp); err != nil {
				return nil, fmt.Errorf("error response (status %d): %s", resp.StatusCode, string(bodyBytes))
			}
			return nil, fmt.Errorf("API error: %s (RID: %s)", errorResp.Error, errorResp.RID)
		}

		return nil, fmt.Errorf("unexpected response (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var response ExtendPackageResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("error decoding response: %v", err)
	}

	return &response, nil
}

// IsSimulationMode checks if the API client is in simulation mode (test credentials)
func (c *APIClient) IsSimulationMode() bool {
	return c.APIKey == "test" && c.AuthUser == "test"
}

// SimulateCreateAccount returns mock data for a create account request
func (c *APIClient) SimulateCreateAccount(req CreateAccountRequest) (*CreateAccountResponse, error) {
	// Generate consistent yet random-looking values
	lineID := "sim-" + uuid.New().String()

	// Set expiration date based on package
	expireAt := time.Now().AddDate(0, req.Package/100, 0)

	// Calculate mock transaction amount
	var transactionAmount float64
	switch req.Package {
	case 101:
		transactionAmount = 100.0
	case 103:
		transactionAmount = 270.0
	case 106:
		transactionAmount = 500.0
	case 112:
		transactionAmount = 950.0
	case 124:
		transactionAmount = 1800.0
	default:
		transactionAmount = 100.0
	}

	return &CreateAccountResponse{
		LineID:            lineID,
		ExpireAt:          expireAt,
		TransactionAmount: transactionAmount,
		RID:               req.RID,
	}, nil
}

// SimulateFindAccount returns mock data for a find account request
func (c *APIClient) SimulateFindAccount(username string) ([]Line, error) {
	// For simulation, return 1-3 mock accounts
	count := 1 + rand.Intn(3)
	if username != "" {
		// If username is provided, return just one account with that username
		count = 1
	}

	lines := make([]Line, count)

	for i := 0; i < count; i++ {
		// Generate random-looking but consistent values
		simUsername := username
		if simUsername == "" {
			simUsername = "test_user_" + fmt.Sprintf("%04d", rand.Intn(10000))
		}

		simPassword := "TestPass" + fmt.Sprintf("%04d", rand.Intn(10000)) + "!"
		// Package numbers: 1, 3, 6, 12, 24 months correspond to 101, 103, 106, 112, 124
		simExpireAt := time.Now().AddDate(0, rand.Intn(12), rand.Intn(30))

		lines[i] = Line{
			LineID:   "sim-" + uuid.New().String(),
			Username: simUsername,
			Password: simPassword,
			ExpireAt: simExpireAt,
		}
	}

	return lines, nil
}

// SimulateExtendPackage returns mock data for an extend package request
func (c *APIClient) SimulateExtendPackage(lineID string, req ExtendPackageRequest) (*ExtendPackageResponse, error) {
	// Calculate expiration date based on package
	expireAt := time.Now().AddDate(0, req.Package/100, 0)

	// Calculate mock transaction amount
	var transactionAmount float64
	switch req.Package {
	case 101:
		transactionAmount = 100.0
	case 103:
		transactionAmount = 270.0
	case 106:
		transactionAmount = 500.0
	case 112:
		transactionAmount = 950.0
	case 124:
		transactionAmount = 1800.0
	default:
		transactionAmount = 100.0
	}

	return &ExtendPackageResponse{
		LineID:            lineID,
		ExpireAt:          expireAt,
		TransactionAmount: transactionAmount,
		RID:               req.RID,
	}, nil
}

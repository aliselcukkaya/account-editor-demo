package utils

import (
	"errors"
	"time"

	"github.com/aliselcukkaya/account-editor/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	// SecretKey is used to sign JWT tokens
	SecretKey = []byte("your-256-bit-secret-key-here") // in production, use environment variables

	// AccessTokenExpireMinutes defines how long tokens are valid
	AccessTokenExpireMinutes = 30
)

// Claims represents JWT claims
type Claims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// HashPassword creates a bcrypt hash of the password
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

// CheckPasswordHash compares a password with a hash
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// CreateAccessToken generates a JWT token for a user
func CreateAccessToken(username string) (string, error) {
	expirationTime := time.Now().Add(time.Duration(AccessTokenExpireMinutes) * time.Minute)

	claims := &Claims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(SecretKey)
}

// VerifyToken validates a JWT token
func VerifyToken(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return SecretKey, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

// AuthenticateUser checks if the username and password are valid
func AuthenticateUser(db *gorm.DB, username, password string) (*models.User, error) {
	var user models.User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}

	if !CheckPasswordHash(password, user.HashedPassword) {
		return nil, errors.New("invalid password")
	}

	if !user.IsActive {
		return nil, errors.New("user is not active")
	}

	return &user, nil
}

# API Error Codes Documentation

This document provides a comprehensive list of all error codes that the backend API can return. Frontend developers should use these codes to handle errors appropriately and provide meaningful feedback to users.

## Error Response Format

All error responses follow this standard format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

## HTTP Status Codes

- **200** - Success
- **201** - Created
- **204** - No Content
- **400** - Bad Request (Validation errors)
- **401** - Unauthorized (Authentication required or invalid)
- **403** - Forbidden (Permission denied)
- **404** - Not Found (Resource doesn't exist)
- **409** - Conflict (Duplicate resource or conflicting state)
- **500** - Internal Server Error
- **503** - Service Unavailable

## Error Codes

### Validation Errors (400)

| Code | Message | Description |
|------|---------|-------------|
| `VALIDATION_ERROR` | Various validation messages | General validation error for invalid input data |
| `BAD_REQUEST` | Bad request | Invalid request format or parameters |

### Authentication Errors (401)

| Code | Message | Description |
|------|---------|-------------|
| `UNAUTHORIZED` | You are not logged in | User authentication required |
| `INVALID_TOKEN` | Invalid token | JWT token is invalid or malformed |
| `TOKEN_EXPIRED` | Token expired | JWT token has expired, user needs to re-login |
| `INVALID_CREDENTIALS` | Incorrect email or password | Login credentials are incorrect |
| `ACCOUNT_DEACTIVATED` | This account has been deactivated | User account has been soft-deleted |

### Authorization Errors (403)

| Code | Message | Description |
|------|---------|-------------|
| `FORBIDDEN` | You do not have permission to perform this action | User lacks required role or permissions |
| `NOT_COURSE_MANAGER` | You can only manage courses assigned to you | User is not an instructor for this course |

### Not Found Errors (404)

| Code | Message | Description |
|------|---------|-------------|
| `NOT_FOUND` | Resource not found | Requested resource doesn't exist |

### Conflict Errors (409)

| Code | Message | Description |
|------|---------|-------------|
| `DUPLICATE_VALUE` | Value already exists for: {field} | Unique constraint violation in database |
| `ALREADY_ENROLLED` | Already enrolled in this course | User is already enrolled in the course |
| `CONFLICT` | Various conflict messages | Resource state conflicts with request |

### Service Errors (503)

| Code | Message | Description |
|------|---------|-------------|
| `SERVICE_UNAVAILABLE` | Service unavailable | External service (e.g., AI API) is not configured or unavailable |

### Internal Errors (500)

| Code | Message | Description |
|------|---------|-------------|
| `INTERNAL_ERROR` | Internal Server Error | Unexpected server error |

### Domain-Specific Error Codes

#### Course Management

| Code | Message | Description |
|------|---------|-------------|
| `COURSE_NOT_FOUND` | Course not found | Course doesn't exist or is deleted |
| `COURSE_NOT_PUBLISHED` | Course not found or not available | Course exists but is not published |

#### Enrollment

| Code | Message | Description |
|------|---------|-------------|
| `ALREADY_ENROLLED` | Already enrolled in this course | User already has an active enrollment |

#### Assignments

| Code | Message | Description |
|------|---------|-------------|
| `DEADLINE_PASSED` | The submission deadline has passed | Assignment due date has passed |

#### Quizzes

| Code | Message | Description |
|------|---------|-------------|
| `QUIZ_NOT_APPROVED` | This quiz is not yet available for students | Quiz must be approved by instructor |

#### Payments (Wafacash)

| Code | Message | Description |
|------|---------|-------------|
| `PAYMENT_ALREADY_PAID` | This payment has already been verified | Payment is already completed |

## Common Validation Rules

### UUID Format
All ID parameters (courseId, userId, lessonId, etc.) must be valid UUIDs in format:
```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Example: `607a5ea7-c944-4ae6-b763-a9ccaa69bf30`

### Email Format
Email addresses must follow standard email format:
```
user@domain.com
```

### Number Ranges
- **Rating**: 1-5 (for course reviews)
- **Grade**: 0-100 (for assignment submissions)
- **Question Count**: 1-20 (for AI quiz generation)

### Enum Values
- **Course Status**: `draft`, `published`, `archived`
- **Course Level**: `beginner`, `intermediate`, `advanced`
- **User Role**: `student`, `instructor`, `admin`
- **Quiz Status**: `draft`, `approved`, `rejected`
- **Payment Status**: `PENDING`, `PAID`, `REJECTED`, `WAITING_VERIFICATION`

## Frontend Error Handling Example

```javascript
try {
  const response = await fetch('/api/v1/courses/123', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  
  if (!data.success) {
    const { code, message } = data.error;
    
    switch (code) {
      case 'VALIDATION_ERROR':
        // Show validation error to user
        showError(message);
        break;
      case 'UNAUTHORIZED':
        // Redirect to login
        redirectToLogin();
        break;
      case 'FORBIDDEN':
        // Show permission denied message
        showError("You don't have permission to access this resource");
        break;
      case 'NOT_FOUND':
        // Show 404 page
        showNotFound();
        break;
      default:
        // Show generic error
        showError("An error occurred. Please try again.");
    }
  }
} catch (error) {
  // Handle network errors
  showError("Network error. Please check your connection.");
}
```

## Prisma-Specific Error Codes

The error middleware automatically handles Prisma errors:

| Prisma Code | Mapped Error Code | Description |
|-------------|-------------------|-------------|
| `P2002` | `DUPLICATE_VALUE` | Unique constraint violation |
| `P2025` | `NOT_FOUND` | Record not found |

## Development Mode

In development mode, error responses include a `stack` field for debugging:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Error message"
  },
  "stack": "Error stack trace..."
}
```

The `stack` field is **not** included in production.

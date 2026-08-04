# 212LEARN Backend API Documentation for Frontend Developers

> **Start here for the team handoff:** [`FRONTEND_TEAM_HANDOFF.md`](./FRONTEND_TEAM_HANDOFF.md)  
> That doc has production gotchas (413 uploads, paywall, Wafacash `action`, Analytics). This file keeps detailed request/response examples.

**Base URL (dev):** `http://localhost:5000/api/v1`  
**Base URL (prod):** `https://backend-212learn.vercel.app/api/v1`  
**API Version:** 1.2.0

### Critical updates (Aug 2026)

1. Large lesson files → `POST /uploads/cloudinary-sign` then Cloudinary, then JSON `{ type, url }` (avoid Vercel 413).
2. Wafacash verify uses `action: "approve"|"reject"` (not `status`).
3. Wafacash submit fields: `paymentReference`, `mtcn`, `receipt`.
4. AI quiz failure → **503** (no mock questions).
5. Cart / wishlist / coupons live under `/cart`, `/wishlist`, `/coupons`.
6. Vercel Analytics → install on the **frontend** (`@vercel/analytics/react`).

---

## Table of Contents
1. [Authentication](#authentication)
2. [Users](#users)
3. [Courses](#courses)
4. [Curriculum (Sections & Lessons)](#curriculum-sections--lessons)
5. [Enrollments](#enrollments)
6. [Resources](#resources)
7. [Assignments & Submissions](#assignments--submissions)
8. [Quizzes](#quizzes)
9. [Progress & Gamification](#progress--gamification)
10. [Reviews & Notifications](#reviews--notifications)
11. [Analytics & Meetings](#analytics--meetings)
12. [Admin & Moderation](#admin--moderation)
13. [Wafacash Payments](#wafacash-payments)
14. [Cart, Wishlist & Coupons](#cart-wishlist--coupons)
15. [Categories](#categories)
16. [Response Formats](#response-formats)
17. [Error Handling](#error-handling)

---

## Authentication

### Register User
**POST** `/auth/register` or `/auth/signup`

**Request Body:**
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string (valid email)",
  "password": "string (min 8 characters)"
}
```

**Response (201):**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "data": {
    "user": {
      "id": "uuid",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "role": "student",
      "avatar": "string | null",
      "bio": "string | null",
      "isVerified": false,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

**Note:** Registration always creates `student` role. Role escalation is prevented.

---

### Login
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "data": {
    "user": {
      "id": "uuid",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "role": "student|instructor|admin",
      "avatar": "string | null",
      "bio": "string | null",
      "isVerified": boolean,
      "lastLogin": "ISO8601 | null",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

---

### Get Current User
**GET** `/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "role": "student|instructor|admin",
      "avatar": "string | null",
      "bio": "string | null",
      "isVerified": boolean,
      "lastLogin": "ISO8601 | null",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

---

## Users

### Get My Profile
**GET** `/users/me`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "role": "student|instructor|admin",
      "avatar": "string | null",
      "bio": "string | null",
      "isVerified": boolean,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

---

### Update My Profile
**PATCH** `/users/me`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "avatar": "string (URL, optional)",
  "bio": "string (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "role": "student|instructor|admin",
      "avatar": "string | null",
      "bio": "string | null",
      "isVerified": boolean,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

---

### Delete My Account
**DELETE** `/users/me`

**Headers:** `Authorization: Bearer <token>`

**Response (204):** No content

---

### List All Users (Admin Only)
**GET** `/users`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)
- `role` (string: student|instructor|admin)
- `search` (string - search by firstName, lastName, email)
- `sort` (string: createdAt|firstName|lastName|email|role, default: createdAt)
- `order` (string: asc|desc, default: desc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "firstName": "string",
        "lastName": "string",
        "email": "string",
        "role": "student|instructor|admin",
        "avatar": "string | null",
        "bio": "string | null",
        "isVerified": boolean,
        "createdAt": "ISO8601",
        "updatedAt": "ISO8601"
      }
    ]
  },
  "meta": {
    "total": 100,
    "totalItems": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### Get User by ID (Admin Only)
**GET** `/users/:id`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "role": "student|instructor|admin",
      "avatar": "string | null",
      "bio": "string | null",
      "isVerified": boolean,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

---

## Courses

### Search Courses
**GET** `/courses/search`

**Query Parameters:**
- `q` (string, required, min 2 characters)
- `page` (integer, default: 1)
- `limit` (integer, default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "courses": [
      {
        "id": "uuid",
        "title": "string",
        "description": "string | null",
        "price": number,
        "level": "beginner|intermediate|advanced | null",
        "language": "string",
        "duration": "integer (minutes) | null",
        "status": "draft|published|archived",
        "categoryId": "uuid | null",
        "category": {
          "id": "uuid",
          "name": "string",
          "description": "string | null"
        },
        "createdAt": "ISO8601",
        "updatedAt": "ISO8601"
      }
    ]
  },
  "meta": {
    "total": 10,
    "totalItems": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### List Courses
**GET** `/courses`

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20, use -1 or 0 for all)
- `sort` (string: createdAt|title|price|duration, default: createdAt)
- `order` (string: asc|desc, default: desc)
- `search` (string - filter by title keyword)
- `categoryId` (uuid)
- `level` (string: beginner|intermediate|advanced)
- `language` (string)
- `status` (string: draft|published|archived - admin only)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "courses": [
      {
        "id": "uuid",
        "title": "string",
        "description": "string | null",
        "price": number,
        "level": "beginner|intermediate|advanced | null",
        "language": "string",
        "duration": "integer (minutes) | null",
        "status": "draft|published|archived",
        "categoryId": "uuid | null",
        "category": {
          "id": "uuid",
          "name": "string",
          "description": "string | null"
        },
        "createdAt": "ISO8601",
        "updatedAt": "ISO8601",
        "_count": {
          "enrollments": number,
          "reviews": number
        }
      }
    ]
  },
  "meta": {
    "total": 50,
    "totalItems": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### Get Course by ID
**GET** `/courses/:id`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "course": {
      "id": "uuid",
      "title": "string",
      "description": "string | null",
      "price": number,
      "level": "beginner|intermediate|advanced | null",
      "language": "string",
      "duration": "integer (minutes) | null",
      "status": "draft|published|archived",
      "categoryId": "uuid | null",
      "category": {
        "id": "uuid",
        "name": "string",
        "description": "string | null"
      },
      "instructors": [
        {
          "id": "uuid",
          "role": "lead_instructor|assistant_instructor|group_formateur",
          "user": {
            "id": "uuid",
            "firstName": "string",
            "lastName": "string",
            "avatar": "string | null",
            "bio": "string | null"
          }
        }
      ],
      "sections": [
        {
          "id": "uuid",
          "courseId": "uuid",
          "title": "string",
          "position": integer,
          "lessons": [
            {
              "id": "uuid",
              "sectionId": "uuid",
              "title": "string",
              "position": integer
            }
          ]
        }
      ],
      "reviews": [
        {
          "id": "uuid",
          "userId": "uuid",
          "courseId": "uuid",
          "rating": integer (1-5),
          "comment": "string | null",
          "reviewDate": "ISO8601",
          "user": {
            "id": "uuid",
            "firstName": "string",
            "lastName": "string",
            "avatar": "string | null"
          }
        }
      ],
      "_count": {
        "enrollments": number,
        "reviews": number,
        "sections": number
      },
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

**Note:** For draft courses, `sections` and instructor `bio` are only included for authorized users (admin, course instructor).

---

### Create Course (Instructor/Admin)
**POST** `/courses`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string",
  "description": "string (optional)",
  "categoryId": "uuid",
  "price": number,
  "level": "beginner|intermediate|advanced (optional)",
  "language": "string (optional)",
  "duration": "integer (minutes, optional)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "course": {
      "id": "uuid",
      "title": "string",
      "description": "string | null",
      "price": number,
      "level": "beginner|intermediate|advanced | null",
      "language": "string",
      "duration": "integer (minutes) | null",
      "status": "draft",
      "categoryId": "uuid",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

---

### Update Course (Instructor/Admin)
**PATCH** `/courses/:id` or `PUT` `/courses/:id`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "price": number (optional),
  "level": "beginner|intermediate|advanced (optional)",
  "language": "string (optional)",
  "duration": "integer (optional)",
  "categoryId": "uuid (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "course": {
      "id": "uuid",
      "title": "string",
      "description": "string | null",
      "price": number,
      "level": "beginner|intermediate|advanced | null",
      "language": "string",
      "duration": "integer (minutes) | null",
      "status": "draft|published|archived",
      "categoryId": "uuid | null",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

---

### Delete Course (Admin Only)
**DELETE** `/courses/:id`

**Headers:** `Authorization: Bearer <token>`

**Response (204):** No content

---

### Publish Course (Admin Only)
**POST** `/courses/:id/publish`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "course": {
      "id": "uuid",
      "status": "published"
    }
  }
}
```

---

### Get Course Reviews
**GET** `/courses/:id/reviews`

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "uuid",
        "userId": "uuid",
        "courseId": "uuid",
        "rating": integer (1-5),
        "comment": "string | null",
        "reviewDate": "ISO8601",
        "user": {
          "id": "uuid",
          "firstName": "string",
          "lastName": "string",
          "avatar": "string | null"
        }
      }
    ],
    "averageRating": number,
    "totalReviews": number
  },
  "meta": {
    "total": 20,
    "totalItems": 20,
    "page": 1,
    "limit": 10,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### Submit Course Review (Enrolled Student Only)
**POST** `/courses/:id/reviews`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "rating": integer (1-5, required),
  "comment": "string (optional)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "review": {
      "id": "uuid",
      "userId": "uuid",
      "courseId": "uuid",
      "rating": integer,
      "comment": "string | null",
      "reviewDate": "ISO8601"
    }
  }
}
```

**Note:** If review already exists, it will be updated (200 response).

---

## Curriculum (Sections & Lessons)

### Get Course Curriculum
**GET** `/courses/:courseId/curriculum`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "curriculum": [
      {
        "id": "uuid",
        "courseId": "uuid",
        "title": "string",
        "position": integer,
        "lessons": [
          {
            "id": "uuid",
            "sectionId": "uuid",
            "title": "string",
            "position": integer,
            "resources": [
              {
                "id": "uuid",
                "lessonId": "uuid",
                "type": "video|pdf|zip|image|link",
                "url": "string | ENROLLMENT_REQUIRED"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**Note:** For non-enrolled users, resource URLs are replaced with `"ENROLLMENT_REQUIRED"`.

---

### Create Section (Instructor/Admin)
**POST** `/courses/:courseId/sections`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string",
  "position": "integer (optional - auto-appends if omitted)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "section": {
      "id": "uuid",
      "courseId": "uuid",
      "title": "string",
      "position": integer,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

---

### Update Section (Instructor/Admin)
**PATCH** `/sections/:id`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string (optional)",
  "position": "integer (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "section": {
      "id": "uuid",
      "courseId": "uuid",
      "title": "string",
      "position": integer,
      "updatedAt": "ISO8601"
    }
  }
}
```

---

### Delete Section (Instructor/Admin)
**DELETE** `/sections/:id`

**Headers:** `Authorization: Bearer <token>`

**Response (204):** No content

---

### Create Lesson (Instructor/Admin)
**POST** `/sections/:sectionId/lessons`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string",
  "position": "integer (optional - auto-appends if omitted)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "lesson": {
      "id": "uuid",
      "sectionId": "uuid",
      "title": "string",
      "position": integer,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

---

### Update Lesson (Instructor/Admin)
**PATCH** `/lessons/:id`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string (optional)",
  "position": "integer (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "lesson": {
      "id": "uuid",
      "sectionId": "uuid",
      "title": "string",
      "position": integer,
      "updatedAt": "ISO8601"
    }
  }
}
```

---

### Delete Lesson (Instructor/Admin)
**DELETE** `/lessons/:id`

**Headers:** `Authorization: Bearer <token>`

**Response (204):** No content

---

## Enrollments

### List My Enrollments
**GET** `/enrollments`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "enrollments": [
      {
        "id": "uuid",
        "userId": "uuid",
        "courseId": "uuid",
        "status": "active|completed|dropped",
        "enrolledAt": "ISO8601",
        "completedAt": "ISO8601 | null",
        "course": {
          "id": "uuid",
          "title": "string",
          "description": "string | null",
          "price": number,
          "level": "beginner|intermediate|advanced | null",
          "language": "string",
          "duration": "integer (minutes) | null",
          "status": "draft|published|archived",
          "category": {
            "id": "uuid",
            "name": "string"
          }
        },
        "payment": {
          "id": "uuid",
          "status": "PENDING|WAITING_VERIFICATION|PAID|REJECTED|REFUNDED",
          "amount": number,
          "currency": "MAD"
        }
      }
    ]
  },
  "meta": {
    "total": 5,
    "totalItems": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### Enroll in Course
**POST** `/enrollments`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "courseId": "uuid"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "enrollment": {
      "id": "uuid",
      "userId": "uuid",
      "courseId": "uuid",
      "status": "active",
      "enrolledAt": "ISO8601",
      "course": {
        "id": "uuid",
        "title": "string",
        "price": number
      }
    }
  }
}
```

---

### Unenroll from Course
**DELETE** `/enrollments/:id`

**Headers:** `Authorization: Bearer <token>`

**Response (204):** No content

---

## Resources

### Add Resource to Lesson (Instructor/Admin)
**POST** `/lessons/:lessonId/resources`

> **CRITICAL (Vercel):** Do **NOT** send the file as `multipart/form-data` to this URL when the file is larger than ~4 MB. Vercel returns `413 FUNCTION_PAYLOAD_TOO_LARGE` **before** the backend runs.
>
> Use **direct Cloudinary upload** for PDFs / ZIPs / videos / images (see below). Copy-paste helper: `examples/uploadLessonResource.js`.

**Headers:** `Authorization: Bearer <token>`

#### ✅ Correct flow (any file up to Cloudinary Free limits)

1. `POST /uploads/cloudinary-sign` with JSON `{ type, filename, mimetype? }`
2. `POST` the file to Cloudinary `uploadUrl` (browser → Cloudinary)
3. `POST /lessons/:lessonId/resources` with JSON `{ type, url: secure_url }`

**Request Body (JSON — after Cloudinary upload):**
```json
{
  "type": "pdf",
  "url": "https://res.cloudinary.com/<cloud>/raw/upload/v123/212learn/pdfs/notes_xxx.pdf"
}
```

`type`: `video` | `pdf` | `zip` | `document` | `image` | `link`

**Request Body (JSON for external link only):**
```json
{
  "type": "link",
  "url": "https://youtube.com/watch?v=abc123"
}
```

**❌ Broken (your current frontend — causes 413):**
```js
const form = new FormData();
form.append('file', pdfFile); // ~4.7 MB
await fetch('/api/v1/lessons/' + lessonId + '/resources', {
  method: 'POST',
  headers: { Authorization: 'Bearer ...' },
  body: form, // Vercel rejects > 4.5 MB
});
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "resource": {
      "id": "uuid",
      "lessonId": "uuid",
      "type": "video|pdf|zip|image|link",
      "url": "string"
    }
  }
}
```

---

### Sign Cloudinary Upload (Instructor/Admin)
**POST** `/uploads/cloudinary-sign`

**Headers:** `Authorization: Bearer <token>` · `Content-Type: application/json`

**Body:**
```json
{
  "type": "pdf",
  "filename": "course-notes.pdf",
  "mimetype": "application/pdf"
}
```

**Response includes:** `uploadUrl`, `apiKey`, `timestamp`, `signature`, `folder`, `public_id`, `resource_type`, `maxBytes`

Then upload to `uploadUrl` with FormData fields: `file`, `api_key`, `timestamp`, `signature`, `folder`, `public_id`.

---

### Delete Resource (Instructor/Admin)
**DELETE** `/resources/:id`

**Headers:** `Authorization: Bearer <token>`

**Response (204):** No content

---

## Assignments & Submissions

### Create Assignment (Instructor/Admin)
**POST** `/lessons/:lessonId/assignments`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string",
  "description": "string (optional)",
  "dueDate": "ISO8601 (optional)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "assignment": {
      "id": "uuid",
      "lessonId": "uuid",
      "title": "string",
      "description": "string | null",
      "dueDate": "ISO8601 | null",
      "createdAt": "ISO8601"
    }
  }
}
```

---

### Get Lesson Assignments
**GET** `/lessons/:lessonId/assignments`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "assignments": [
      {
        "id": "uuid",
        "lessonId": "uuid",
        "title": "string",
        "dueDate": "ISO8601 | null",
        "submissions": [
          {
            "id": "uuid",
            "assignmentId": "uuid",
            "userId": "uuid",
            "fileUrl": "string | null",
            "grade": number | null,
            "feedback": "string | null",
            "submittedAt": "ISO8601"
          }
        ]
      }
    ]
  }
}
```

---

### Submit Assignment (Student)
**POST** `/assignments/:assignmentId/submissions`

**Headers:** `Authorization: Bearer <token>`

**Request Body (multipart/form-data):**
- `file` (binary, optional - PDF, ZIP, or image file, max 200MB)

**Request Body (JSON):**
```json
{
  "fileUrl": "string (already-hosted URL)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "submission": {
      "id": "uuid",
      "assignmentId": "uuid",
      "userId": "uuid",
      "fileUrl": "string | null",
      "submittedAt": "ISO8601"
    }
  }
}
```

---

### Get Assignment Submissions (Instructor/Admin)
**GET** `/assignments/:assignmentId/submissions`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "id": "uuid",
        "assignmentId": "uuid",
        "userId": "uuid",
        "fileUrl": "string | null",
        "grade": number | null,
        "feedback": "string | null",
        "submittedAt": "ISO8601",
        "user": {
          "id": "uuid",
          "firstName": "string",
          "lastName": "string",
          "email": "string"
        }
      }
    ]
  },
  "meta": {
    "total": 10,
    "totalItems": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### Grade Submission (Instructor/Admin)
**PATCH** `/submissions/:id/grade` or `PUT` `/submissions/:id/grade`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "grade": number (0-100, required),
  "feedback": "string (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "submission": {
      "id": "uuid",
      "assignmentId": "uuid",
      "userId": "uuid",
      "grade": number,
      "feedback": "string | null",
      "gradedAt": "ISO8601"
    }
  }
}
```

---

## Quizzes

### Get Course Quizzes
**GET** `/courses/:courseId/quizzes`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "quizzes": [
      {
        "id": "uuid",
        "lessonId": "uuid",
        "title": "string",
        "validationStatus": "draft|approved|rejected",
        "questionCount": integer,
        "lessonTitle": "string",
        "sectionTitle": "string",
        "lastAttempt": {
          "score": number,
          "attemptDate": "ISO8601"
        } | null
      }
    ]
  }
}
```

---

### Create Quiz (Instructor/Admin)
**POST** `/lessons/:lessonId/quizzes`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "quiz": {
      "id": "uuid",
      "lessonId": "uuid",
      "title": "string",
      "validationStatus": "draft",
      "createdAt": "ISO8601"
    }
  }
}
```

---

### Generate AI Quiz (Instructor/Admin)
**POST** `/lessons/:lessonId/quizzes/generate-ai`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string",
  "prompt": "string",
  "questionCount": integer (1-20, default: 5, optional)
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "quiz": {
      "id": "uuid",
      "lessonId": "uuid",
      "title": "string",
      "validationStatus": "draft",
      "questions": [
        {
          "id": "uuid",
          "quizId": "uuid",
          "statement": "string",
          "options": ["string", "string", "string", "string"],
          "correctAnswer": "string"
        }
      ]
    }
  }
}
```

---

### Add Quiz Question (Instructor/Admin)
**POST** `/quizzes/:quizId/questions`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "statement": "string",
  "options": ["string", "string", "string", "string"],
  "correctAnswer": "string (must match one option exactly)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "question": {
      "id": "uuid",
      "quizId": "uuid",
      "statement": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string"
    }
  }
}
```

---

### Get Quiz
**GET** `/quizzes/:quizId`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "quiz": {
      "id": "uuid",
      "lessonId": "uuid",
      "title": "string",
      "validationStatus": "draft|approved|rejected",
      "questions": [
        {
          "id": "uuid",
          "quizId": "uuid",
          "statement": "string",
          "options": ["string", "string", "string", "string"]
        }
      ]
    }
  }
}
```

**Note:** `correctAnswer` is hidden for students.

---

### Update Quiz (Instructor/Admin)
**PATCH** `/quizzes/:quizId`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string (optional)",
  "validationStatus": "draft|approved|rejected (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "quiz": {
      "id": "uuid",
      "title": "string",
      "validationStatus": "draft|approved|rejected",
      "updatedAt": "ISO8601"
    }
  }
}
```

---

### Submit Quiz Attempt (Student)
**POST** `/quizzes/:quizId/attempts`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "answers": [
    {
      "questionId": "uuid",
      "selectedAnswer": "string (must match one option exactly)"
    }
  ],
  "duration": integer (seconds taken, optional)
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "attempt": {
      "id": "uuid",
      "quizId": "uuid",
      "userId": "uuid",
      "score": number,
      "totalQuestions": integer,
      "correctAnswers": integer,
      "duration": integer,
      "attemptDate": "ISO8601",
      "passed": boolean
    }
  }
}
```

---

## Progress & Gamification

### Log Lesson Progress (Student)
**POST** `/lessons/:lessonId/progress`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "completed": boolean,
  "videoPosition": integer (seconds, optional),
  "timeSpent": integer (seconds, optional)
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "progress": {
      "id": "uuid",
      "userId": "uuid",
      "lessonId": "uuid",
      "completed": boolean,
      "videoPosition": integer,
      "timeSpent": integer,
      "startedAt": "ISO8601",
      "completedAt": "ISO8601 | null"
    }
  }
}
```

---

### Get User Achievements
**GET** `/users/:userId/achievements`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "points": integer,
      "completedLessons": integer,
      "badgesEarned": integer,
      "certificatesEarned": integer,
      "totalEnrollments": integer,
      "completionRate": number (percentage)
    },
    "badges": [
      {
        "id": "uuid",
        "name": "string",
        "description": "string",
        "icon": "string",
        "earnedAt": "ISO8601"
      }
    ],
    "certificates": [
      {
        "id": "uuid",
        "userId": "uuid",
        "courseId": "uuid",
        "courseTitle": "string",
        "completionDate": "ISO8601"
      }
    ],
    "quizAttempts": [
      {
        "id": "uuid",
        "quizId": "uuid",
        "quizTitle": "string",
        "score": number,
        "attemptDate": "ISO8601"
      }
    ]
  }
}
```

**Note:** Users can only view their own achievements (except admins).

---

## Reviews & Notifications

### Get User Notifications
**GET** `/users/:userId/notifications`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `unreadOnly` (boolean - return only unread notifications)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "userId": "uuid",
        "content": "string",
        "isRead": boolean,
        "createdAt": "ISO8601"
      }
    ],
    "unreadCount": integer,
    "totalNotifications": integer
  }
}
```

---

### Mark All Notifications as Read
**PATCH** `/users/:userId/notifications/read-all`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "All notifications marked as read."
  }
}
```

---

## Analytics & Meetings

### Get Revenue Analytics (Instructor/Admin)
**GET** `/instructor/analytics/revenue`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalRevenue": number,
    "currency": "MAD",
    "months": integer,
    "monthly": [
      {
        "month": "string (e.g., '2026-01')",
        "revenue": number
      }
    ],
    "topCourses": ["string", "string"]
  }
}
```

---

### Get Student Analytics (Instructor/Admin)
**GET** `/instructor/analytics/students`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalStudents": integer,
    "totalEnrollments": integer,
    "coursesCount": integer,
    "recentEnrollments": [
      {
        "courseId": "uuid",
        "courseTitle": "string",
        "enrollmentDate": "ISO8601"
      }
    ]
  }
}
```

---

### Get Completion Analytics (Instructor/Admin)
**GET** `/instructor/analytics/completion`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "courses": [
      {
        "courseId": "uuid",
        "title": "string",
        "totalEnrolled": integer,
        "completedCount": integer,
        "completionRate": number (percentage),
        "averageProgress": number (percentage)
      }
    ]
  }
}
```

---

### Get Course Meetings
**GET** `/courses/:courseId/meetings`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "upcoming": [
      {
        "id": "uuid",
        "courseId": "uuid",
        "title": "string",
        "meetingUrl": "string",
        "meetingDate": "ISO8601"
      }
    ],
    "past": [
      {
        "id": "uuid",
        "courseId": "uuid",
        "title": "string",
        "meetingUrl": "string",
        "meetingDate": "ISO8601"
      }
    ],
    "total": integer
  }
}
```

**Note:** Access requires enrollment (PAID status) or instructor/admin role.

---

### Create Meeting (Instructor/Admin)
**POST** `/courses/:courseId/meetings`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "string",
  "meetingUrl": "string (valid URL)",
  "meetingDate": "ISO8601"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "meeting": {
      "id": "uuid",
      "courseId": "uuid",
      "title": "string",
      "meetingUrl": "string",
      "meetingDate": "ISO8601",
      "createdAt": "ISO8601"
    },
    "notified": integer
  }
}
```

---

## Admin & Moderation

### Get Pending KYC (Admin Only)
**GET** `/admin/users/pending-kyc`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "firstName": "string",
        "lastName": "string",
        "email": "string",
        "role": "instructor",
        "isVerified": false,
        "createdAt": "ISO8601"
      }
    ]
  },
  "meta": {
    "total": 5,
    "totalItems": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### Verify Instructor (Admin Only)
**PATCH** `/admin/users/:userId/verify`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "isVerified": boolean,
  "notes": "string (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "isVerified": boolean
    },
    "message": "KYC verification updated."
  }
}
```

---

### Refund Payment (Admin Only)
**PATCH** `/admin/payments/:paymentId/refund`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "notes": "string (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "uuid",
      "status": "REFUNDED"
    }
  }
}
```

---

### Get Audit Logs (Admin Only)
**GET** `/admin/audit-logs`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "userId": "uuid",
        "action": "string",
        "resource": "string",
        "resourceId": "uuid",
        "details": {},
        "createdAt": "ISO8601",
        "user": {
          "firstName": "string",
          "lastName": "string",
          "email": "string"
        }
      }
    ]
  },
  "meta": {
    "total": 50,
    "totalItems": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### List Groups (Admin Only)
**GET** `/admin/groups`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20)
- `courseId` (uuid)
- `formateurId` (uuid)
- `search` (string)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "id": "uuid",
        "name": "string",
        "description": "string | null",
        "courseId": "uuid | null",
        "formateurId": "uuid",
        "formateur": {
          "id": "uuid",
          "firstName": "string",
          "lastName": "string",
          "email": "string"
        },
        "course": {
          "id": "uuid",
          "title": "string"
        } | null,
        "students": [
          {
            "id": "uuid",
            "firstName": "string",
            "lastName": "string",
            "email": "string"
          }
        ],
        "_count": {
          "students": integer
        },
        "createdAt": "ISO8601",
        "updatedAt": "ISO8601"
      }
    ]
  },
  "meta": {
    "total": 10,
    "totalItems": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### Create Group (Admin Only)
**POST** `/admin/groups`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "string",
  "description": "string (optional)",
  "courseId": "uuid (optional)",
  "formateurId": "uuid",
  "studentIds": ["uuid", "uuid"] (optional)
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "group": {
      "id": "uuid",
      "name": "string",
      "description": "string | null",
      "courseId": "uuid | null",
      "formateurId": "uuid",
      "createdAt": "ISO8601"
    }
  }
}
```

---

### Assign Group Formateur (Admin Only)
**PATCH** `/admin/groups/:groupId/formateur`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "formateurId": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "group": {
      "id": "uuid",
      "formateurId": "uuid"
    }
  }
}
```

---

### Add Students to Group (Admin Only)
**POST** `/admin/groups/:groupId/students`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "studentIds": ["uuid", "uuid"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Students added to group successfully."
  }
}
```

---

### Remove Student from Group (Admin Only)
**DELETE** `/admin/groups/:groupId/students/:studentId`

**Headers:** `Authorization: Bearer <token>`

**Response (204):** No content

---

## Wafacash Payments

Roles: **request/submit** = student · **pending/verify** = admin.  
Ownership: submit only works for the logged-in student's own `paymentReference`.

### Request Wafacash Payment
**POST** `/payments/wafacash/request`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "courseId": "uuid",
  "couponCode": "TEST10"
}
```

`couponCode` is optional. Returns **201** for a new request, or **200** if an existing `PENDING` / `WAITING_VERIFICATION` payment already exists.

**Response (201):**
```json
{
  "success": true,
  "data": {
    "message": "Wafacash payment request initialized successfully.",
    "paymentId": "uuid",
    "paymentReference": "WFC-XXXXXXXX",
    "amount": "299.00",
    "currency": "MAD",
    "instructions": {
      "step1": "Visit your nearest Wafacash agency in Morocco.",
      "step2": "Provide them with the payment reference: WFC-XXXXXXXX",
      "step3": "Pay the cash amount: 299.00 MAD",
      "step4": "Upload your receipt picture and submit the 10-digit MTCN code on your dashboard."
    }
  }
}
```

Show `paymentReference` to the student for the cash transfer.

---

### Submit Wafacash Receipt
**POST** `/payments/wafacash/submit`

**Headers:** `Authorization: Bearer <token>`

**Request Body (multipart/form-data):**
- `paymentReference` (string, e.g. `WFC-XXXXXXXX`) — **required**
- `mtcn` (string, 10-digit MTCN code) — **required**
- `receipt` (binary, image file) — **required**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "uuid",
      "status": "WAITING_VERIFICATION",
      "mtcn": "string",
      "receiptUrl": "string",
      "submittedAt": "ISO8601"
    }
  }
}
```

---

### Get Pending Wafacash Payments (Admin Only)
**GET** `/payments/wafacash/pending`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "uuid",
        "enrollmentId": "uuid",
        "status": "WAITING_VERIFICATION",
        "amount": "number",
        "currency": "MAD",
        "transactionReference": "string",
        "mtcn": "string",
        "receiptUrl": "string",
        "submittedAt": "ISO8601",
        "enrollment": {
          "id": "uuid",
          "userId": "uuid",
          "courseId": "uuid",
          "user": {
            "firstName": "string",
            "lastName": "string",
            "email": "string"
          },
          "course": {
            "title": "string"
          }
        }
      }
    ]
  }
}
```

---

### Verify Wafacash Payment (Admin Only)
**PATCH** `/payments/wafacash/verify`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "paymentId": "uuid",
  "action": "approve",
  "notes": "string (optional)"
}
```

`action` must be `"approve"` or `"reject"` (not `status`).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "uuid",
      "status": "PAID",
      "verifiedAt": "ISO8601"
    },
    "message": "string"
  }
}
```

---

## Cart, Wishlist & Coupons

Roles: cart/wishlist = **student** or **admin**. Coupon CRUD = **admin**. Validate = any authenticated user.

### Get Cart
**GET** `/cart`

**Headers:** `Authorization: Bearer <token>`

Auto-creates an empty cart if needed. Returns items + MAD subtotal.

### Clear Cart
**DELETE** `/cart`

### Add Cart Item
**POST** `/cart/items`

```json
{ "courseId": "uuid" }
```

**409** if already in cart or already purchased (PAID).

### Remove Cart Item
**DELETE** `/cart/items/:itemId`

### Get Wishlist
**GET** `/wishlist`

### Add to Wishlist
**POST** `/wishlist`

```json
{ "courseId": "uuid" }
```

### Remove from Wishlist
**DELETE** `/wishlist/:courseId` → **204**

### Validate Coupon
**POST** `/coupons/validate`

```json
{ "code": "TEST10", "courseId": "uuid" }
```

`courseId` optional — when present, response includes discounted price preview. Codes are case-insensitive.

### Admin Coupon CRUD
| Method | Path |
|--------|------|
| GET | `/coupons` |
| POST | `/coupons` — `{ code, discount (0–100), expirationDate }` |
| PATCH | `/coupons/:id` |
| DELETE | `/coupons/:id` → **204** |

---

## Categories

### Get Category Tree
**GET** `/categories`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "uuid",
        "name": "string",
        "description": "string | null",
        "parentId": "uuid | null",
        "children": [
          {
            "id": "uuid",
            "name": "string",
            "description": "string | null",
            "parentId": "uuid",
            "children": []
          }
        ]
      }
    ]
  }
}
```

---

### Create Category (Admin Only)
**POST** `/categories`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "string",
  "description": "string (optional)",
  "parentId": "uuid (optional - omit for top-level)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "category": {
      "id": "uuid",
      "name": "string",
      "description": "string | null",
      "parentId": "uuid | null",
      "createdAt": "ISO8601"
    }
  }
}
```

---

## Response Formats

### Success Response
```json
{
  "success": true,
  "data": {},
  "meta": {} // Optional for paginated responses
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Pagination Meta
```json
{
  "total": 100,
  "totalItems": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

---

## Error Handling

### Common Error Codes
- `VALIDATION_ERROR` - Invalid request data
- `UNAUTHORIZED` - Missing or invalid token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `ACCOUNT_DEACTIVATED` - User account soft-deleted

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `204` - No content
- `400` - Bad request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not found
- `409` - Conflict
- `429` - Rate limit exceeded
- `500` - Internal server error
- `503` - Service unavailable (e.g. Groq AI)
- `413` - Payload too large (Vercel body limit — use Cloudinary-sign)

---

## Authentication Header

All protected endpoints require:

```
Authorization: Bearer <jwt_token>
```

Token comes from `/auth/login` or `/auth/register`.

---

## Rate Limiting

- Auth endpoints: **10** requests / minute / IP
- Global: **150** requests / 15 minutes / IP
- Disabled in local `development` (unless enforced)
- Production uses Upstash Redis when configured

---

## File Uploads

| Context | How |
|---------|-----|
| Lesson resources (PDF/video/ZIP/image) on **Vercel** | **Required:** `POST /uploads/cloudinary-sign` → upload to Cloudinary → `POST /lessons/:id/resources` with JSON `{ type, url }` |
| External link | JSON `{ type: "link", url }` |
| Avatar / Wafacash receipt | Small multipart to API is OK |
| Cloudinary Free limits | Image/raw **10 MB**, video **100 MB** |
| Vercel body limit | ~**4.5 MB** — larger multipart → **413** |

Helper: `examples/uploadLessonResource.js`. Details: [`FRONTEND_TEAM_HANDOFF.md`](./FRONTEND_TEAM_HANDOFF.md#3-critical--file-uploads-vercel-413).

---

## Security Features

- Draft courses: admins / course instructors only for full content
- Meetings: PAID enrollment or instructor/admin
- Registration always creates `student` (no self-escalation)
- Soft-deleted users cannot authenticate
- `limit=-1` / `0` (fetch-all) blocked in production by default

---

## Live Documentation

- Local Swagger: `http://localhost:5000/api-docs`
- Production Swagger: often **disabled** unless `ENABLE_API_DOCS=true`
- Team handoff: [`FRONTEND_TEAM_HANDOFF.md`](./FRONTEND_TEAM_HANDOFF.md)

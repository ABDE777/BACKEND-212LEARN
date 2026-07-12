import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '212Learning API',
      version: '1.0.0',
      description:
        'REST API for the 212Learning e-learning platform.\n\n' +
        '**All responses follow a consistent envelope:**\n\n' +
        '```json\n// Success\n{ "success": true, "data": {}, "meta": {} }\n\n// Error\n{ "success": false, "error": { "code": "...", "message": "..." } }\n```\n\n' +
        '**Authentication:** Use the `POST /auth/login` endpoint to get a JWT token, ' +
        'then click the **Authorize** button above and enter: `Bearer <your_token>`',
      contact: { name: '212Learning Team', email: 'support@212learning.ma' },
      license: { name: 'MIT' },
    },
    servers: [
      { url: 'http://localhost:5000/api/v1', description: 'Local development (v1)' },
      { url: 'https://backend-212learn.vercel.app/api/v1', description: 'Production — Vercel (v1)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste your JWT token from POST /auth/login here.',
        },
      },
      schemas: {

        // ─── Response Envelopes ──────────────────────────────────────────────
        SuccessResponse: {
          type: 'object',
          description: 'Standard success envelope',
          properties: {
            success: { type: 'boolean', example: true },
            data:    { type: 'object', description: 'Payload varies per endpoint' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          description: 'Paginated success envelope',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            meta: {
              type: 'object',
              properties: {
                total:      { type: 'integer', example: 100 },
                page:       { type: 'integer', example: 1 },
                limit:      { type: 'integer', example: 20 },
                totalPages: { type: 'integer', example: 5 },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          description: 'Standard error envelope',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code:    { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'email and password are required.' },
              },
            },
          },
        },

        // ─── Auth ────────────────────────────────────────────────────────────
        RegisterInput: {
          type: 'object',
          required: ['firstName', 'lastName', 'email', 'password'],
          properties: {
            firstName: { type: 'string', example: 'Mohamed' },
            lastName:  { type: 'string', example: 'Alaoui' },
            email:     { type: 'string', format: 'email', example: 'mohamed@212learning.ma' },
            password:  { type: 'string', format: 'password', minLength: 8, example: 'SecurePass123!' },
            role:      { type: 'string', enum: ['student', 'instructor', 'admin'], default: 'student', description: 'Defaults to student if omitted' },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'admin@212learn.com' },
            password: { type: 'string', format: 'password', example: 'Admin@212learn' },
          },
        },
        AuthResponse: {
          type: 'object',
          description: 'Returned on successful login or register',
          properties: {
            success: { type: 'boolean', example: true },
            token:   { type: 'string', description: 'JWT — attach as `Bearer <token>` in subsequent requests', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            data: {
              type: 'object',
              properties: { user: { $ref: '#/components/schemas/User' } },
            },
          },
        },

        // ─── User ────────────────────────────────────────────────────────────
        User: {
          type: 'object',
          description: 'Full user object returned by the API',
          properties: {
            id:         { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
            firstName:  { type: 'string', example: 'Mohamed' },
            lastName:   { type: 'string', example: 'Alaoui' },
            email:      { type: 'string', format: 'email', example: 'mohamed@212learning.ma' },
            role:       { type: 'string', enum: ['student', 'instructor', 'admin'] },
            avatar:     { type: 'string', format: 'uri', nullable: true, example: 'https://images.unsplash.com/photo-...' },
            bio:        { type: 'string', nullable: true, example: 'Passionate about full-stack engineering.' },
            isVerified: { type: 'boolean', example: true },
            lastLogin:  { type: 'string', format: 'date-time', nullable: true },
            createdAt:  { type: 'string', format: 'date-time' },
            updatedAt:  { type: 'string', format: 'date-time' },
          },
        },
        UpdateUserInput: {
          type: 'object',
          description: 'Allowed fields for PATCH /users/me',
          properties: {
            firstName: { type: 'string', example: 'Youssef' },
            lastName:  { type: 'string', example: 'Bennani' },
            avatar:    { type: 'string', format: 'uri', example: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330' },
            bio:       { type: 'string', example: 'Full-stack developer & e-learning enthusiast.' },
          },
        },

        // ─── Category ────────────────────────────────────────────────────────
        Category: {
          type: 'object',
          description: 'A course category (can be nested)',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            name:        { type: 'string', example: 'Web Development' },
            description: { type: 'string', nullable: true, example: 'HTML, CSS, JavaScript, React, Node.js.' },
            parentId:    { type: 'string', format: 'uuid', nullable: true, description: 'Null for top-level categories' },
            children:    { type: 'array', items: { $ref: '#/components/schemas/Category' }, description: 'Nested sub-categories (tree structure)' },
            createdAt:   { type: 'string', format: 'date-time' },
          },
        },
        CategoryInput: {
          type: 'object',
          required: ['name'],
          description: 'Payload for creating a category',
          properties: {
            name:        { type: 'string', example: 'Mobile Development' },
            description: { type: 'string', example: 'iOS, Android, React Native.' },
            parentId:    { type: 'string', format: 'uuid', nullable: true, description: 'Omit or set to null for top-level' },
          },
        },

        // ─── Course ──────────────────────────────────────────────────────────
        Course: {
          type: 'object',
          description: 'A course in the 212Learning catalog',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            title:       { type: 'string', example: 'React from Zero to Hero' },
            description: { type: 'string', nullable: true },
            price:       { type: 'number', format: 'float', example: 299.99 },
            level:       { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], nullable: true },
            language:    { type: 'string', example: 'french' },
            duration:    { type: 'integer', description: 'Total duration in minutes', example: 1200, nullable: true },
            status:      { type: 'string', enum: ['draft', 'published', 'archived'], description: 'Only published courses appear in the public catalog' },
            categoryId:  { type: 'string', format: 'uuid', nullable: true },
            createdAt:   { type: 'string', format: 'date-time' },
            updatedAt:   { type: 'string', format: 'date-time' },
          },
        },
        CreateCourseInput: {
          type: 'object',
          required: ['title', 'categoryId', 'price'],
          description: 'Payload for creating a new course (instructors & admins)',
          properties: {
            title:       { type: 'string', example: 'React from Zero to Hero' },
            description: { type: 'string', example: 'Master React, hooks, state management and production deployments.' },
            categoryId:  { type: 'string', format: 'uuid', example: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890' },
            price:       { type: 'number', format: 'float', example: 299.99 },
            level:       { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], example: 'intermediate' },
            language:    { type: 'string', example: 'french' },
            duration:    { type: 'integer', description: 'Duration in minutes', example: 1200 },
          },
        },
        UpdateCourseInput: {
          type: 'object',
          description: 'Payload for partially updating a course — all fields optional',
          properties: {
            title:       { type: 'string', example: 'Advanced React Patterns' },
            description: { type: 'string' },
            price:       { type: 'number', format: 'float', example: 199.99 },
            level:       { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
            language:    { type: 'string', example: 'english' },
            duration:    { type: 'integer' },
            categoryId:  { type: 'string', format: 'uuid' },
          },
        },

        // ─── Enrollment ──────────────────────────────────────────────────────
        Enrollment: {
          type: 'object',
          description: 'A student enrollment in a course',
          properties: {
            id:           { type: 'string', format: 'uuid' },
            userId:       { type: 'string', format: 'uuid' },
            courseId:     { type: 'string', format: 'uuid' },
            status:       { type: 'string', enum: ['active', 'completed', 'dropped'], example: 'active' },
            enrolledAt:   { type: 'string', format: 'date-time' },
            completedAt:  { type: 'string', format: 'date-time', nullable: true },
            course:       { $ref: '#/components/schemas/Course', description: 'Populated course object' },
          },
        },
        EnrollInput: {
          type: 'object',
          required: ['courseId'],
          description: 'Payload for enrolling in a course',
          properties: {
            courseId: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth',        description: 'Register, login, token refresh' },
      { name: 'Users',       description: 'User profile management (own profile + admin)' },
      { name: 'Categories',  description: 'Course category tree management' },
      { name: 'Courses',     description: 'Course catalogue — public browsing and instructor management' },
      { name: 'Enrollments', description: 'Enroll / unenroll from published courses' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

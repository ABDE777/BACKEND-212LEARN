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
        '```json\n// Success\n{ "success": true, "data": {}, "meta": {} }\n\n// Error\n{ "success": false, "error": { "code": "...", "message": "..." } }\n```',
      contact: { name: '212Learning Team', email: 'support@212learning.ma' },
    },
    servers: [
      { url: 'http://localhost:5000/api/v1', description: 'Local development (v1)' },
      { url: 'https://api.212learning.ma/api/v1', description: 'Production (v1)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste your JWT here. Example: **Bearer eyJhbGci...**',
        },
      },
      schemas: {
        // ─── Envelopes ─────────────────────────────────────────────────────
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data:    { type: 'object' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            meta: {
              type: 'object',
              properties: {
                total:      { type: 'integer', example: 100 },
                page:       { type: 'integer', example: 1 },
                limit:      { type: 'integer', example: 20 },
                totalPages: { type: 'integer', example: 5 },
              },
            },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
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
        // ─── Auth ──────────────────────────────────────────────────────────
        RegisterInput: {
          type: 'object',
          required: ['firstName', 'lastName', 'email', 'password'],
          properties: {
            firstName: { type: 'string', example: 'Mohamed' },
            lastName:  { type: 'string', example: 'Alaoui' },
            email:     { type: 'string', format: 'email', example: 'mohamed@212learning.ma' },
            password:  { type: 'string', format: 'password', example: 'SecurePass123' },
            role:      { type: 'string', enum: ['student', 'instructor', 'admin'], default: 'student' },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'mohamed@212learning.ma' },
            password: { type: 'string', format: 'password', example: 'SecurePass123' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            token:   { type: 'string',  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            data: {
              type: 'object',
              properties: { user: { $ref: '#/components/schemas/User' } },
            },
          },
        },
        // ─── User ──────────────────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            id:         { type: 'string', format: 'uuid' },
            firstName:  { type: 'string' },
            lastName:   { type: 'string' },
            email:      { type: 'string', format: 'email' },
            role:       { type: 'string', enum: ['student', 'instructor', 'admin'] },
            avatar:     { type: 'string', nullable: true },
            bio:        { type: 'string', nullable: true },
            isVerified: { type: 'boolean' },
            lastLogin:  { type: 'string', format: 'date-time', nullable: true },
            createdAt:  { type: 'string', format: 'date-time' },
          },
        },
        // ─── Course ────────────────────────────────────────────────────────
        Course: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            title:       { type: 'string' },
            description: { type: 'string', nullable: true },
            price:       { type: 'number', example: 299.99 },
            level:       { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], nullable: true },
            language:    { type: 'string', example: 'fr' },
            duration:    { type: 'integer', description: 'Minutes', nullable: true },
            status:      { type: 'string', enum: ['draft', 'published', 'archived'] },
            createdAt:   { type: 'string', format: 'date-time' },
          },
        },
        CreateCourseInput: {
          type: 'object',
          required: ['title', 'categoryId', 'price'],
          properties: {
            title:       { type: 'string', example: 'React from Zero to Hero' },
            description: { type: 'string' },
            categoryId:  { type: 'string', format: 'uuid' },
            price:       { type: 'number', example: 299.99 },
            level:       { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
            language:    { type: 'string', example: 'fr' },
            duration:    { type: 'integer', example: 1200 },
            status:      { type: 'string', enum: ['draft', 'published'] },
          },
        },
        // ─── Enrollment ────────────────────────────────────────────────────
        Enrollment: {
          type: 'object',
          properties: {
            id:         { type: 'string', format: 'uuid' },
            userId:     { type: 'string', format: 'uuid' },
            courseId:   { type: 'string', format: 'uuid' },
            enrolledAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth',        description: 'Register, login, token refresh' },
      { name: 'Users',       description: 'User profile management' },
      { name: 'Courses',     description: 'Course catalogue (public + instructor management)' },
      { name: 'Enrollments', description: 'Enroll / unenroll from courses' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

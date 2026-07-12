import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '212Learning API',
      version: '1.0.0',
      description:
        'Full REST API for the 212Learning e-learning platform. Covers authentication, courses, enrollments, quizzes, gamification, and more.',
      contact: {
        name: '212Learning Team',
        email: 'support@212learning.ma',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development server (v1)',
      },
      {
        url: 'https://api.212learning.ma/api/v1',
        description: 'Production server (v1)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token. Example: **Bearer eyJhbGci...**',
        },
      },
      schemas: {
        // ─── Auth ────────────────────────────────────────────────────
        RegisterInput: {
          type: 'object',
          required: ['firstName', 'lastName', 'email', 'password'],
          properties: {
            firstName: { type: 'string', example: 'Mohamed' },
            lastName: { type: 'string', example: 'Alaoui' },
            email: { type: 'string', format: 'email', example: 'mohamed@example.com' },
            password: { type: 'string', format: 'password', example: 'SecurePass123' },
            role: { type: 'string', enum: ['student', 'instructor', 'admin'], default: 'student' },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'mohamed@example.com' },
            password: { type: 'string', format: 'password', example: 'SecurePass123' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            data: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
        // ─── User ────────────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['student', 'instructor', 'admin'] },
            avatar: { type: 'string', nullable: true },
            bio: { type: 'string', nullable: true },
            isVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ─── Course ──────────────────────────────────────────────────
        Course: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            price: { type: 'number', format: 'float', example: 299.99 },
            level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], nullable: true },
            language: { type: 'string', example: 'fr' },
            duration: { type: 'integer', description: 'Total duration in minutes', nullable: true },
            status: { type: 'string', enum: ['draft', 'published', 'archived'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateCourseInput: {
          type: 'object',
          required: ['title', 'categoryId', 'price'],
          properties: {
            title: { type: 'string', example: 'React from Zero to Hero' },
            description: { type: 'string' },
            categoryId: { type: 'string', format: 'uuid' },
            price: { type: 'number', example: 299.99 },
            level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
            language: { type: 'string', example: 'fr' },
            duration: { type: 'integer', example: 1200 },
            status: { type: 'string', enum: ['draft', 'published'] },
          },
        },
        // ─── Enrollment ──────────────────────────────────────────────
        Enrollment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            courseId: { type: 'string', format: 'uuid' },
            enrolledAt: { type: 'string', format: 'date-time' },
          },
        },
        // ─── Error ───────────────────────────────────────────────────
        ErrorResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            message: { type: 'string', example: 'Something went wrong' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints (register, login)' },
      { name: 'Users', description: 'User profile management' },
      { name: 'Courses', description: 'Course catalogue management' },
      { name: 'Enrollments', description: 'Course enrollment and progress' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

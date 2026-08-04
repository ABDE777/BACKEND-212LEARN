import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '212Learning API',
      version: '1.1.0',
      description:
        'REST API for the 212Learning e-learning platform.\n\n' +
        '**Security Features:**\n' +
        '- Draft courses are protected - only accessible to admins and course instructors\n' +
        '- Course meetings require enrollment (PAID status) or instructor/admin access\n' +
        '- Registration forces student role - role escalation prevented\n' +
        '- Soft-deleted users cannot authenticate\n' +
        '- Pagination supports `limit=-1` and `limit=0` for full-fetch\n\n' +
        '**All responses follow a consistent envelope:**\n\n' +
        '```json\n// Success\n{ "success": true, "data": {}, "meta": {} }\n\n// Error\n{ "success": false, "error": { "code": "...", "message": "..." } }\n```\n\n' +
        '**Authentication:** Use the `POST /auth/login` endpoint to get a JWT token, ' +
        'then click the **Authorize** button above and enter: `Bearer <your_token>`\n\n' +
        '**Password Management:**\n' +
        '- `POST /auth/forgot-password` — public, sends a 5-min reset link by email\n' +
        '- `POST /auth/reset-password/:token` — public, sets new password using the emailed link token\n' +
        '- `PATCH /users/me/password` — logged-in user changes their own password (requires current password)\n' +
        '- `POST /admin/users/:userId/reset-password` — admin triggers sending a 5-min reset link email to any user',
      contact: { name: '212Learn Support', email: '212learn.support@gmail.com' },
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
                total:       { type: 'integer', example: 100 },
                totalItems:  { type: 'integer', example: 100 },
                page:        { type: 'integer', example: 1 },
                limit:       { type: 'integer', example: 20 },
                totalPages:  { type: 'integer', example: 5 },
                hasNextPage: { type: 'boolean', example: true },
                hasPrevPage: { type: 'boolean', example: false },
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

        // ─── Password Management ─────────────────────────────────────────────
        ForgotPasswordInput: {
          type: 'object',
          required: ['email'],
          description: 'Step 1 of the forgot-password flow — request a reset link by email',
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
          },
        },
        ResetPasswordInput: {
          type: 'object',
          required: ['newPassword'],
          description: 'Step 2 of the forgot-password flow — submit a new password using the token from the email link',
          properties: {
            newPassword: { type: 'string', format: 'password', minLength: 8, example: 'MyNewSecurePass123!' },
          },
        },
        ChangePasswordInput: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          description: 'Logged-in user changes their own password — current password required',
          properties: {
            currentPassword: { type: 'string', format: 'password', example: 'OldPassword123' },
            newPassword:     { type: 'string', format: 'password', minLength: 8, example: 'NewSecurePass456!' },
          },
        },
        AdminResetPasswordInput: {
          type: 'object',
          required: ['newPassword'],
          description: 'Admin forcefully resets a user password — no current password required',
          properties: {
            newPassword: { type: 'string', format: 'password', minLength: 8, example: 'TempPassword789!' },
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

        // ─── Curriculum ──────────────────────────────────────────────────────
        Section: {
          type: 'object',
          description: 'A course section (grouping of lessons)',
          properties: {
            id:       { type: 'string', format: 'uuid' },
            courseId: { type: 'string', format: 'uuid' },
            title:    { type: 'string', example: 'Getting Started' },
            position: { type: 'integer', example: 1, description: 'Order within the course' },
            lessons:  { type: 'array', items: { $ref: '#/components/schemas/Lesson' } },
          },
        },
        SectionInput: {
          type: 'object',
          description: 'Payload for creating or updating a section',
          properties: {
            title:    { type: 'string', example: 'Introduction to React' },
            position: { type: 'integer', example: 1, description: 'Desired position — omit to auto-append' },
          },
        },
        Lesson: {
          type: 'object',
          description: 'A single lesson inside a section',
          properties: {
            id:        { type: 'string', format: 'uuid' },
            sectionId: { type: 'string', format: 'uuid' },
            title:     { type: 'string', example: 'What is JSX?' },
            position:  { type: 'integer', example: 1 },
            resources: { type: 'array', items: { $ref: '#/components/schemas/Resource' } },
          },
        },
        LessonInput: {
          type: 'object',
          description: 'Payload for creating or updating a lesson',
          properties: {
            title:    { type: 'string', example: 'Understanding Props' },
            position: { type: 'integer', example: 2 },
          },
        },

        // ─── Resources ───────────────────────────────────────────────────────
        Resource: {
          type: 'object',
          description: 'A media/document resource attached to a lesson',
          properties: {
            id:       { type: 'string', format: 'uuid' },
            lessonId: { type: 'string', format: 'uuid' },
            type:     { type: 'string', enum: ['video', 'pdf', 'zip', 'image', 'link'], example: 'video' },
            url:      { type: 'string', format: 'uri', example: 'https://res.cloudinary.com/...' },
          },
        },

        // ─── Assignments ──────────────────────────────────────────────────────
        AssignmentInput: {
          type: 'object',
          required: ['title'],
          description: 'Payload for creating an assignment',
          properties: {
            title:       { type: 'string', example: 'Build a Todo App in React' },
            description: { type: 'string', nullable: true, example: 'Implement useState and list rendering.' },
            dueDate:     { type: 'string', format: 'date-time', example: '2026-09-01T23:59:00Z', nullable: true },
          },
        },
        Assignment: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            lessonId:    { type: 'string', format: 'uuid' },
            title:       { type: 'string', example: 'Build a Todo App in React' },
            description: { type: 'string', nullable: true },
            dueDate:     { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Submission: {
          type: 'object',
          properties: {
            id:           { type: 'string', format: 'uuid' },
            assignmentId: { type: 'string', format: 'uuid' },
            userId:       { type: 'string', format: 'uuid' },
            fileUrl:      { type: 'string', format: 'uri', nullable: true },
            grade:        { type: 'number', example: 87.5, nullable: true },
            feedback:     { type: 'string', nullable: true, example: 'Good work! Clean code.' },
            submittedAt:  { type: 'string', format: 'date-time' },
          },
        },
        GradeInput: {
          type: 'object',
          required: ['grade'],
          description: 'Payload for grading a submission',
          properties: {
            grade:    { type: 'number', minimum: 0, maximum: 100, example: 87.5 },
            feedback: { type: 'string', example: 'Good work! Clean code and well-structured.' },
          },
        },

        // ─── Admin Groups ─────────────────────────────────────────────────────
        Group: {
          type: 'object',
          description: 'Training group assigned to a formateur, optionally linked to a course',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            name:        { type: 'string', example: 'Groupe Web A1' },
            description: { type: 'string', nullable: true, example: 'Morning web development group.' },
            courseId:    { type: 'string', format: 'uuid', nullable: true },
            formateurId: { type: 'string', format: 'uuid' },
            createdById: { type: 'string', format: 'uuid', nullable: true },
            createdAt:   { type: 'string', format: 'date-time' },
            updatedAt:   { type: 'string', format: 'date-time' },
            deletedAt:   { type: 'string', format: 'date-time', nullable: true },
          },
        },
        CreateGroupInput: {
          type: 'object',
          required: ['name', 'formateurId'],
          properties: {
            name:        { type: 'string', example: 'Groupe Web A1' },
            description: { type: 'string', example: 'Morning web development group.' },
            courseId:    { type: 'string', format: 'uuid', nullable: true, description: 'Optional course assigned to the group' },
            formateurId: { type: 'string', format: 'uuid', description: 'Instructor/formateur user id' },
            studentIds:  { type: 'array', items: { type: 'string', format: 'uuid' }, example: ['11111111-1111-1111-1111-111111111111'] },
          },
        },
        AssignGroupFormateurInput: {
          type: 'object',
          required: ['formateurId'],
          properties: {
            formateurId: { type: 'string', format: 'uuid', description: 'Instructor/formateur user id' },
          },
        },
        AddGroupStudentsInput: {
          type: 'object',
          required: ['studentIds'],
          properties: {
            studentIds: { type: 'array', items: { type: 'string', format: 'uuid' }, example: ['11111111-1111-1111-1111-111111111111'] },
          },
        },
      },
    },
    tags: [
      { name: 'Auth',        description: 'Register, login, forgot password, reset password' },
      { name: 'Users',       description: 'User profile management — own profile + change password + admin operations' },
      { name: 'Admin',       description: 'Admin-only operations — user management, KYC, groups, audit logs, password reset' },
      { name: 'Categories',  description: 'Course category tree management' },
      { name: 'Courses',     description: 'Course catalogue — public browsing and instructor management' },
      { name: 'Enrollments', description: 'Enroll / unenroll from published courses' },
      { name: 'Curriculum',  description: 'Sections & Lessons — pedagogical content hierarchy' },
      { name: 'Resources',   description: 'Lesson resource attachments (video, PDF, ZIP, image, link)' },
      { name: 'Assignments', description: 'Assignments, student submissions, and instructor grading' },
      { name: 'Cart',        description: 'Student shopping cart' },
      { name: 'Wishlist',    description: 'Student saved courses' },
      { name: 'Coupons',     description: 'Discount coupons — validate + admin CRUD' },
      { name: 'Quizzes',     description: 'MCQ quizzes, AI generation, and student attempts' },
      { name: 'Payments',    description: 'Wafacash Moroccan cash payment flow' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

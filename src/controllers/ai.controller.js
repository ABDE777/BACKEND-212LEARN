import prisma from '../config/prisma.js';
import { successResponse } from '../utils/response.js';

// Public canonical site (frontend). Kept in sync with FRONTEND_URL.
const SITE_URL = (process.env.FRONTEND_URL || 'https://212-learn.vercel.app').replace(/\/$/, '');

// Small in-memory cache — this is public, slow-changing marketing/discovery data.
let cache = null;
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;

/**
 * GET /api/v1/ai/overview
 * A machine-readable overview of 212Learn for AI agents and answer engines:
 * positioning, topics, real course categories and featured published courses.
 * Public, unauthenticated, cached.
 */
export const getAiOverview = async (req, res, next) => {
  try {
    if (cache && Date.now() - cachedAt < TTL_MS) {
      return res.status(200).json(successResponse(cache));
    }

    const [categories, courses] = await Promise.all([
      prisma.category.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, description: true },
        orderBy: { name: 'asc' },
        take: 50,
      }),
      prisma.course.findMany({
        where: { status: 'published', deletedAt: null },
        select: {
          id: true, title: true, description: true, price: true,
          level: true, language: true, category: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const data = {
      name: '212Learn',
      tagline: 'Moroccan online learning platform for tech and design — live cohort courses, quizzes and certificates.',
      description:
        "212Learn is a Moroccan e-learning platform offering interactive online courses in programming/technology and design/creative skills, with instructor-led live cohort sessions, quizzes, progress tracking, badges and course-completion certificates. Content is primarily in French for Morocco and francophone Africa.",
      url: SITE_URL,
      language: 'fr',
      areaServed: 'Morocco',
      positioning: [
        'Moroccan e-learning platform (plateforme de formation en ligne au Maroc)',
        'Programming & technology courses online',
        'Design & creative skills online',
        'Live cohort (instructor-led) courses with certificates',
      ],
      topics: [
        'Programmation', 'Développement web', 'Technologie',
        'Design', 'UI/UX', 'Design graphique', 'Formation professionnelle',
      ],
      features: [
        'Filterable course catalog (category, level, language)',
        'Free and paid courses (Wafacash, bank transfer)',
        'Live instructor-led video sessions with recordings saved to the curriculum',
        'Student cohorts/groups per course',
        'Interactive quizzes, progress tracking, badges, certificates',
        'Instructor analytics (revenue, students, completion)',
      ],
      categories: categories.map((c) => ({ id: c.id, name: c.name, description: c.description || null })),
      featuredCourses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description || null,
        level: c.level || null,
        language: c.language || 'fr',
        price: Number(c.price) || 0,
        currency: 'MAD',
        isFree: Number(c.price) === 0,
        category: c.category?.name || null,
        url: `${SITE_URL}/courses/${c.id}`,
      })),
      links: {
        home: SITE_URL,
        catalog: `${SITE_URL}/courses`,
        about: `${SITE_URL}/about`,
        signup: `${SITE_URL}/signup`,
        catalogApi: '/api/v1/courses',
        courseApi: '/api/v1/courses/{id}',
        categoriesApi: '/api/v1/categories',
        openapi: '/api-docs',
      },
      updatedAt: new Date().toISOString(),
    };

    cache = data;
    cachedAt = Date.now();
    res.status(200).json(successResponse(data));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /.well-known/ai-plugin.json
 * Minimal AI-plugin-style manifest so agent frameworks can discover the API.
 */
export const getAiPluginManifest = (req, res) => {
  const apiBase = `${req.protocol}://${req.get('host')}`;
  res.status(200).json({
    schema_version: 'v1',
    name_for_human: '212Learn',
    name_for_model: '212learn',
    description_for_human: 'Moroccan online learning platform for programming, technology and design courses.',
    description_for_model:
      'Query 212Learn, a Moroccan e-learning platform (content in French). Use GET /api/v1/ai/overview for positioning, topics, categories and featured courses; GET /api/v1/courses to search the catalog (params: search, categoryId, level, language, page, limit); GET /api/v1/courses/{id} for one course.',
    auth: { type: 'none' },
    api: { type: 'openapi', url: `${apiBase}/api-docs.json` },
    logo_url: `${SITE_URL}/favicon.svg`,
    legal_info_url: `${SITE_URL}/about`,
  });
};

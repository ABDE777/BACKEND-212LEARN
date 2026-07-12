import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';

// GET /api/v1/categories
export const getCategories = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    // Build the tree in-memory
    const categoryMap = {};
    categories.forEach((cat) => {
      categoryMap[cat.id] = {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        parentId: cat.parentId,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        children: [],
      };
    });

    const rootCategories = [];
    categories.forEach((cat) => {
      const mapped = categoryMap[cat.id];
      if (cat.parentId) {
        const parent = categoryMap[cat.parentId];
        if (parent) {
          parent.children.push(mapped);
        } else {
          // If parent is not found for some reason, treat as root
          rootCategories.push(mapped);
        }
      } else {
        rootCategories.push(mapped);
      }
    });

    res.status(200).json(successResponse({ categories: rootCategories }));
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/categories
export const createCategory = async (req, res, next) => {
  try {
    const { name, description, parentId } = req.body;

    if (!name) {
      return next(new AppError('name is required.', 400, 'VALIDATION_ERROR'));
    }

    // If parentId is provided, check if it exists
    if (parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        return next(new AppError(`Parent category with ID ${parentId} not found.`, 404, 'NOT_FOUND'));
      }
    }

    // Check if category name is already taken
    const existing = await prisma.category.findUnique({
      where: { name },
    });
    if (existing) {
      return next(new AppError(`Category name "${name}" is already taken.`, 409, 'CONFLICT'));
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        parentId: parentId || null,
      },
    });

    res.status(201).json(successResponse({ category }));
  } catch (error) {
    next(error);
  }
};

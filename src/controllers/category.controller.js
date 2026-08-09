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
        icon: cat.icon,
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
    const { name, description, icon, parentId } = req.body;

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
        icon,
        parentId: parentId || null,
      },
    });

    res.status(201).json(successResponse({ category }));
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/categories/:id
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, icon, parentId } = req.body;

    // Check if category exists
    const existing = await prisma.category.findUnique({
      where: { id },
    });
    if (!existing) {
      return next(new AppError(`Category with ID ${id} not found.`, 404, 'NOT_FOUND'));
    }

    // If name is being changed, check if new name is already taken
    if (name && name !== existing.name) {
      const nameConflict = await prisma.category.findUnique({
        where: { name },
      });
      if (nameConflict) {
        return next(new AppError(`Category name "${name}" is already taken.`, 409, 'CONFLICT'));
      }
    }

    // If parentId is provided, check if it exists and is not the category itself
    if (parentId) {
      if (parentId === id) {
        return next(new AppError('A category cannot be its own parent.', 400, 'VALIDATION_ERROR'));
      }
      const parent = await prisma.category.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        return next(new AppError(`Parent category with ID ${parentId} not found.`, 404, 'NOT_FOUND'));
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(parentId !== undefined && { parentId: parentId || null }),
      },
    });

    res.status(200).json(successResponse({ category }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/categories/:id
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const existing = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { courses: true, children: true },
        },
      },
    });
    if (!existing) {
      return next(new AppError(`Category with ID ${id} not found.`, 404, 'NOT_FOUND'));
    }

    // Check if category has courses or subcategories
    if (existing._count.courses > 0) {
      return next(new AppError('Cannot delete category with associated courses.', 400, 'VALIDATION_ERROR'));
    }
    if (existing._count.children > 0) {
      return next(new AppError('Cannot delete category with subcategories.', 400, 'VALIDATION_ERROR'));
    }

    await prisma.category.delete({
      where: { id },
    });

    res.status(200).json(successResponse({ message: 'Category deleted successfully' }));
  } catch (error) {
    next(error);
  }
};

import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID } from '../utils/validation.js';
import { moderateMessageText } from './groupChat.controller.js';

const senderSelect = {
  select: { id: true, firstName: true, lastName: true, avatar: true, role: true },
};

/**
 * Access to a course chat: admins, the course's instructor(s), and enrolled
 * students. Everyone else is forbidden.
 */
const checkCourseChatAccess = async (courseId, user) => {
  if (user.role === 'admin') return true;

  const [instructor, enrollment] = await Promise.all([
    prisma.courseInstructor.findFirst({ where: { courseId, userId: user.id }, select: { id: true } }),
    prisma.enrollment.findFirst({ where: { courseId, userId: user.id }, select: { id: true } }),
  ]);
  return Boolean(instructor || enrollment);
};

// GET /api/v1/courses/:courseId/messages
export const getCourseMessages = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    validateUUID(courseId, 'courseId');

    if (!(await checkCourseChatAccess(courseId, req.user))) {
      return next(new AppError("Vous n'avez pas accès au chat de ce cours.", 403, 'FORBIDDEN'));
    }

    const messages = await prisma.courseChatMessage.findMany({
      where: { courseId, status: { in: ['approved', 'deleted'] } },
      include: { sender: senderSelect },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json(successResponse(messages, 'Messages du cours récupérés avec succès.'));
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/courses/:courseId/messages
export const sendCourseMessage = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    validateUUID(courseId, 'courseId');
    const { text, fileUrl, fileType, fileName } = req.body;

    if ((!text || !text.trim()) && !fileUrl) {
      return next(new AppError('Veuillez saisir un texte ou joindre un fichier.', 400, 'VALIDATION_ERROR'));
    }

    if (!(await checkCourseChatAccess(courseId, req.user))) {
      return next(new AppError("Vous n'avez pas la permission d'envoyer des messages dans ce cours.", 403, 'FORBIDDEN'));
    }

    // AI moderation (shared with the group chat).
    if (text && text.trim()) {
      const modResult = await moderateMessageText(text);
      if (modResult.isBlocked) {
        return res.status(400).json({
          success: false,
          code: 'AI_MODERATION_BLOCKED',
          error: {
            message: modResult.reason || 'Message bloqué par la modération IA : Contenu inapproprié ou langage offensant détecté.',
          },
        });
      }
    }

    const savedMessage = await prisma.courseChatMessage.create({
      data: {
        courseId,
        senderId: req.user.id,
        text: text ? text.trim() : null,
        fileUrl: fileUrl || null,
        fileType: fileType || null,
        fileName: fileName || null,
        status: 'approved',
      },
      include: { sender: senderSelect },
    });

    return res.status(201).json(successResponse(savedMessage, 'Message envoyé avec succès.'));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/courses/:courseId/messages/:messageId
export const deleteCourseMessage = async (req, res, next) => {
  try {
    const { courseId, messageId } = req.params;
    validateUUID(courseId, 'courseId');
    validateUUID(messageId, 'messageId');

    const message = await prisma.courseChatMessage.findUnique({ where: { id: messageId } });
    if (!message || message.courseId !== courseId) {
      return next(new AppError('Message introuvable.', 404, 'NOT_FOUND'));
    }

    // Author, the course instructor(s), or an admin may delete.
    const isPrivileged = req.user.role === 'admin'
      || Boolean(await prisma.courseInstructor.findFirst({ where: { courseId, userId: req.user.id }, select: { id: true } }));
    if (message.senderId !== req.user.id && !isPrivileged) {
      return next(new AppError("Seul l'auteur, le formateur ou un administrateur peut supprimer ce message.", 403, 'FORBIDDEN'));
    }

    await prisma.courseChatMessage.update({
      where: { id: messageId },
      data: { status: 'deleted', text: '[Ce message a été supprimé]' },
    });

    return res.status(200).json(successResponse({ id: messageId }, 'Message supprimé avec succès.'));
  } catch (error) {
    next(error);
  }
};

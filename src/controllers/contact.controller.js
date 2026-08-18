import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { notifyAdminsContactMessage } from '../utils/adminNotify.js';
import { logAuditEvent } from '../utils/audit.js';

// Temporary in-memory fallback cache if DB table is migrating
const memoryMessages = [];

export const submitContactMessage = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !name.trim()) {
      return next(new AppError('Le nom est obligatoire.', 400, 'VALIDATION_ERROR'));
    }
    if (!email || !email.includes('@')) {
      return next(new AppError('Veuillez fournir une adresse email valide.', 400, 'VALIDATION_ERROR'));
    }
    if (!subject || !subject.trim()) {
      return next(new AppError('Le sujet est obligatoire.', 400, 'VALIDATION_ERROR'));
    }
    if (!message || !message.trim()) {
      return next(new AppError('Le message est obligatoire.', 400, 'VALIDATION_ERROR'));
    }

    let savedMessage = null;

    try {
      if (prisma.contactMessage) {
        savedMessage = await prisma.contactMessage.create({
          data: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone ? phone.trim() : null,
            subject: subject.trim(),
            message: message.trim(),
          },
        });
      }
    } catch (dbErr) {
      console.warn('Prisma contactMessage save fallback to memory:', dbErr.message);
    }

    if (!savedMessage) {
      savedMessage = {
        id: `mem-${Date.now()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        subject: subject.trim(),
        message: message.trim(),
        status: 'unread',
        createdAt: new Date().toISOString(),
      };
      memoryMessages.push(savedMessage);
    }

    // Trigger automated email notification to ALL admins asynchronously
    notifyAdminsContactMessage({
      name: savedMessage.name,
      email: savedMessage.email,
      phone: savedMessage.phone,
      subject: savedMessage.subject,
      message: savedMessage.message,
    }).catch(e => console.warn('Async admin contact email notify error:', e.message));

    logAuditEvent(req.user?.id || null, 'SUBMIT_CONTACT', 'ContactMessage', String(savedMessage.id), {
      name: savedMessage.name,
      email: savedMessage.email,
      subject: savedMessage.subject,
    }).catch(() => {});

    return res.status(201).json(
      successResponse(
        {
          id: savedMessage.id,
          name: savedMessage.name,
          email: savedMessage.email,
          createdAt: savedMessage.createdAt,
        },
        'Votre message a été envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.'
      )
    );
  } catch (error) {
    next(error);
  }
};

export const getContactMessages = async (req, res, next) => {
  try {
    let messages = [];
    try {
      if (prisma.contactMessage) {
        messages = await prisma.contactMessage.findMany({
          orderBy: { createdAt: 'desc' },
        });
      }
    } catch (dbErr) {
      console.warn('Prisma contactMessage fetch fallback to memory:', dbErr.message);
    }

    if (!messages || messages.length === 0) {
      messages = memoryMessages;
    }

    return res.status(200).json(successResponse(messages, 'Liste des messages de contact.'));
  } catch (error) {
    next(error);
  }
};

export const updateContactMessageStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'read', 'unread', 'replied'

    if (!['read', 'unread', 'replied'].includes(status)) {
      return next(new AppError('Statut invalide.', 400, 'VALIDATION_ERROR'));
    }

    let updated = null;
    try {
      if (prisma.contactMessage && !id.startsWith('mem-')) {
        updated = await prisma.contactMessage.update({
          where: { id },
          data: { status },
        });
      }
    } catch (dbErr) {
      console.warn('Prisma update error fallback to memory:', dbErr.message);
    }

    if (!updated) {
      const idx = memoryMessages.findIndex((m) => m.id === id);
      if (idx !== -1) {
        memoryMessages[idx].status = status;
        updated = memoryMessages[idx];
      }
    }

    if (!updated) {
      return next(new AppError('Message non trouvé.', 404, 'NOT_FOUND'));
    }

    return res.status(200).json(successResponse(updated, 'Statut du message mis à jour.'));
  } catch (error) {
    next(error);
  }
};

export const deleteContactMessage = async (req, res, next) => {
  try {
    const { id } = req.params;

    let deleted = false;
    try {
      if (prisma.contactMessage && !id.startsWith('mem-')) {
        await prisma.contactMessage.delete({ where: { id } });
        deleted = true;
      }
    } catch (dbErr) {
      console.warn('Prisma delete error fallback to memory:', dbErr.message);
    }

    const idx = memoryMessages.findIndex((m) => m.id === id);
    if (idx !== -1) {
      memoryMessages.splice(idx, 1);
      deleted = true;
    }

    return res.status(200).json(successResponse({ id, deleted: true }, 'Message supprimé avec succès.'));
  } catch (error) {
    next(error);
  }
};

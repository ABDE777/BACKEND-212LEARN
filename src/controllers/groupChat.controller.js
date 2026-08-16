import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';

// In-memory fallback message storage if DB table migration is pending
const memoryGroupMessages = {};

/**
 * AI Content Moderation Engine powered by Groq API (llama-3.3-70b-versatile)
 * Analyzes text for insults, profanity, harassment, and toxicity in FR, AR/Darija, EN.
 */
export const moderateMessageText = async (text) => {
  if (!text || !text.trim()) return { isBlocked: false, reason: 'clean' };

  const trimmedText = text.trim();

  // Local fallback regex for instant detection of extreme profanity
  const localToxicPattern = /\b(hmar|kaleb|khra|zamel|kelb|zeb|taboun|pousse|putain|salope|connard|enculé|bâtard|chienne|fuck|bitch|asshole|motherfucker)\b/i;
  if (localToxicPattern.test(trimmedText)) {
    return {
      isBlocked: true,
      reason: 'Contenu inapproprié ou langage offensant détecté par le filtre automatique.',
    };
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return { isBlocked: false, reason: 'groq_not_configured' };
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a strict, automated content safety AI moderator for 212Learn educational group chats.
Your job is to analyze user text messages sent in French, Arabic (including Franco-Arabic / Darija transliterations like hmar, zamel, khra, kelb), or English.

FLAG AS TOXIC (isToxic: true) if the text contains:
1. Insults, profanity, swearing, vulgarity, or offensive name-calling.
2. Harassment, hate speech, violent threats, or severe toxicity.
3. Sexually explicit or illegal solicitations.

Respond strictly in JSON format with NO extra commentary:
{"isToxic": true, "reason": "Short French explanation of violation"} or {"isToxic": false, "reason": "clean"}`,
          },
          {
            role: 'user',
            content: `Evaluate this text: "${trimmedText}"`,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (groqRes.ok) {
      const groqData = await groqRes.json();
      const content = groqData?.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      if (parsed.isToxic) {
        return {
          isBlocked: true,
          reason: parsed.reason || 'Message bloqué par la modération IA : Contenu inapproprié ou langage offensant détecté.',
        };
      }
    }
  } catch (err) {
    console.warn('Groq AI moderation check warning:', err.message);
  }

  return { isBlocked: false, reason: 'clean' };
};

/**
 * Check if the requesting user is authorized to read/write in a group chat
 */
const checkGroupAccess = async (groupId, userId, userRole) => {
  if (userRole === 'admin') return true;

  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { students: true },
    });

    if (!group) return false;

    // Check if user is the assigned instructor
    if (group.formateurId === userId || group.createdById === userId) return true;

    // Check if user is an enrolled student in this group
    const isStudent = group.students.some((s) => s.userId === userId);
    return isStudent;
  } catch (err) {
    console.warn('DB checkGroupAccess fallback to true:', err.message);
    return true; // Fallback permit
  }
};

/**
 * GET /api/v1/groups/:groupId/messages
 * Fetch messages for a specific group chat
 */
export const getGroupMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const hasAccess = await checkGroupAccess(groupId, userId, userRole);
    if (!hasAccess) {
      return next(new AppError('Vous n\'avez pas accès au chat de ce groupe.', 403, 'FORBIDDEN'));
    }

    let messages = [];

    try {
      if (prisma.groupChatMessage) {
        messages = await prisma.groupChatMessage.findMany({
          where: {
            groupId,
            status: { in: ['approved', 'deleted'] },
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        });
      }
    } catch (dbErr) {
      console.warn('Prisma groupChatMessage findMany fallback to memory:', dbErr.message);
    }

    if (!messages || messages.length === 0) {
      messages = memoryGroupMessages[groupId] || [];
    }

    return res.status(200).json(successResponse(messages, 'Messages du groupe récupérés avec succès.'));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/groups/:groupId/messages
 * Send a message (text and/or file) into a group chat with Groq AI Content Moderation
 */
export const sendGroupMessage = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { text, fileUrl, fileType, fileName } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if ((!text || !text.trim()) && !fileUrl) {
      return next(new AppError('Veuillez saisir un texte ou joindre un fichier.', 400, 'VALIDATION_ERROR'));
    }

    const hasAccess = await checkGroupAccess(groupId, userId, userRole);
    if (!hasAccess) {
      return next(new AppError('Vous n\'avez pas la permission d\'envoyer des messages dans ce groupe.', 403, 'FORBIDDEN'));
    }

    // ── AI Moderation Inspection ──────────────────────────────────────────────
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

    let savedMessage = null;

    try {
      if (prisma.groupChatMessage) {
        savedMessage = await prisma.groupChatMessage.create({
          data: {
            groupId,
            senderId: userId,
            text: text ? text.trim() : null,
            fileUrl: fileUrl || null,
            fileType: fileType || null,
            fileName: fileName || null,
            status: 'approved',
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                role: true,
              },
            },
          },
        });
      }
    } catch (dbErr) {
      console.warn('Prisma groupChatMessage create fallback to memory:', dbErr.message);
    }

    if (!savedMessage) {
      savedMessage = {
        id: `mem-chat-${Date.now()}`,
        groupId,
        senderId: userId,
        text: text ? text.trim() : null,
        fileUrl: fileUrl || null,
        fileType: fileType || null,
        fileName: fileName || null,
        status: 'approved',
        createdAt: new Date().toISOString(),
        sender: {
          id: req.user.id,
          firstName: req.user.firstName || 'Utilisateur',
          lastName: req.user.lastName || '',
          avatar: req.user.avatar || null,
          role: req.user.role || 'student',
        },
      };

      if (!memoryGroupMessages[groupId]) {
        memoryGroupMessages[groupId] = [];
      }
      memoryGroupMessages[groupId].push(savedMessage);
    }

    return res.status(201).json(successResponse(savedMessage, 'Message envoyé avec succès.'));
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/groups/:groupId/messages/:messageId
 * Delete a message from group chat
 */
export const deleteGroupMessage = async (req, res, next) => {
  try {
    const { groupId, messageId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    let message = null;
    try {
      if (prisma.groupChatMessage && !messageId.startsWith('mem-chat-')) {
        message = await prisma.groupChatMessage.findUnique({ where: { id: messageId } });
      }
    } catch (err) {
      console.warn('Prisma findUnique error fallback:', err.message);
    }

    // Check ownership or instructor/admin rights
    if (message && message.senderId !== userId && userRole !== 'admin') {
      return next(new AppError('Seul l\'auteur du message ou un administrateur peut le supprimer.', 403, 'FORBIDDEN'));
    }

    try {
      if (prisma.groupChatMessage && !messageId.startsWith('mem-chat-')) {
        await prisma.groupChatMessage.update({
          where: { id: messageId },
          data: { status: 'deleted', text: '[Ce message a été supprimé]' },
        });
      }
    } catch (err) {
      console.warn('Prisma update status deleted fallback:', err.message);
    }

    if (memoryGroupMessages[groupId]) {
      const idx = memoryGroupMessages[groupId].findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        memoryGroupMessages[groupId][idx].status = 'deleted';
        memoryGroupMessages[groupId][idx].text = '[Ce message a été supprimé]';
      }
    }

    return res.status(200).json(successResponse({ id: messageId }, 'Message supprimé avec succès.'));
  } catch (error) {
    next(error);
  }
};

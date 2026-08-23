import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID, validateRequired, validateEnum } from '../utils/validation.js';
import { ensureCourseManager } from '../utils/authorization.js';
import { getJaasConfig, signJaasJwt, shouldUsePublicJitsi, PUBLIC_JITSI_DOMAIN, isJaasConfigured } from '../config/jaas.js';
import crypto from 'crypto';

// ─── Webhook Signature Verification ─────────────────────────────────────────────
/**
 * Verify JaaS webhook signature to prevent unauthorized requests.
 * Uses HMAC-SHA256 with a shared secret key.
 */
const verifyJaasWebhook = (req) => {
  const secret = process.env.JAAS_WEBHOOK_SECRET;
  const signature = req.headers['x-jaas-signature'] || req.headers['x-webhook-signature'];

  // Fail CLOSED: if no secret is configured we cannot verify anything, so reject.
  // (Previously this returned true, letting any caller drive meeting state.)
  if (!secret) {
    console.error('JAAS_WEBHOOK_SECRET not configured — rejecting unverifiable webhook.');
    return false;
  }

  if (!signature) {
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');

  try {
    const sigBuf = Buffer.from(String(signature), 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    // Length guard: timingSafeEqual throws on unequal lengths.
    return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
};

// POST /api/v1/courses/:courseId/meetings - Create meeting (instructor/admin)
export const createMeeting = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, meetingDate, durationMinutes } = req.body;

    validateUUID(courseId, 'courseId');
    validateRequired(req.body, ['title', 'meetingDate']);

    await ensureCourseManager(req.user, courseId);

    // Deterministic, unguessable room slug — the slug is the only thing
    // protecting the room, so keep it unpredictable. Shared by instructor
    // and students so both land in the same MiroTalk room.
    const roomSlug = `212learn-${courseId}-${Date.now()}`;

    // MiroTalk SFU room (self-hosted, no active-user/month cap). Base URL from
    // MIROTALK_URL (your server); falls back to the public MiroTalk instance.
    const mirotalkBase = (process.env.MIROTALK_URL || 'https://sfu.mirotalk.com').replace(/\/+$/, '');
    const meetingUrl = `${mirotalkBase}/join?room=${encodeURIComponent(roomSlug)}`;

    const meeting = await prisma.meeting.create({
      data: {
        courseId,
        title,
        meetingDate: new Date(meetingDate),
        roomName: roomSlug,
        status: 'SCHEDULED',
        durationMinutes: durationMinutes || 60,
        meetingUrl,
      },
    });

    res.status(201).json(successResponse({ meeting }));
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/courses/:courseId/meetings - Get meetings (instructor/admin for all, students for completed)
export const getCourseMeetings = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    validateUUID(courseId, 'courseId');

    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    // Admins have unconditional access. Instructors need access to THIS course
    // (being an instructor of some other course must not grant it). Students need
    // an enrollment.
    const isAdmin = req.user.role === 'admin';
    const isInstructor = await prisma.courseInstructor.findFirst({
      where: { courseId, userId: req.user.id },
    });

    const isEnrolled = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId,
        },
      },
    });

    if (!isAdmin && !isInstructor && !isEnrolled) {
      return next(new AppError('You do not have access to this course.', 403, 'FORBIDDEN'));
    }

    const meetings = await prisma.meeting.findMany({
      where: { courseId },
      orderBy: { meetingDate: 'desc' },
    });

    // For students, show all meetings (SCHEDULED, LIVE, COMPLETED) so they can see upcoming sessions
    const filteredMeetings = meetings;

    res.status(200).json(successResponse({ meetings: filteredMeetings }));
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/meetings - Get all meetings (admin only)
export const getAllMeetings = async (req, res, next) => {
  try {
    const meetings = await prisma.meeting.findMany({
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { meetingDate: 'desc' },
    });

    res.status(200).json(successResponse({ meetings }));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/meetings/:id/start - Start meeting (instructor/admin)
export const startMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateUUID(id, 'meetingId');

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!meeting) {
      return next(new AppError('Meeting not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, meeting.courseId);

    if (meeting.status !== 'SCHEDULED') {
      return next(new AppError('Meeting can only be started from SCHEDULED status.', 400, 'BAD_REQUEST'));
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data: { status: 'LIVE' },
    });

    res.status(200).json(successResponse({ meeting: updated }));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/meetings/:id/end - End meeting (instructor/admin)
export const endMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateUUID(id, 'meetingId');

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!meeting) {
      return next(new AppError('Meeting not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, meeting.courseId);

    if (meeting.status !== 'LIVE') {
      return next(new AppError('Meeting can only be ended from LIVE status.', 400, 'BAD_REQUEST'));
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    res.status(200).json(successResponse({ meeting: updated }));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/meetings/:id - Update meeting (instructor/admin) - only for SCHEDULED meetings
export const updateMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, meetingDate, meetingUrl } = req.body;
    validateUUID(id, 'meetingId');

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!meeting) {
      return next(new AppError('Meeting not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, meeting.courseId);

    if (meeting.status !== 'SCHEDULED') {
      return next(new AppError('Only SCHEDULED meetings can be modified.', 400, 'BAD_REQUEST'));
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (meetingDate) updateData.meetingDate = new Date(meetingDate);
    if (meetingUrl !== undefined) updateData.meetingUrl = meetingUrl;

    const updated = await prisma.meeting.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json(successResponse({ meeting: updated }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/meetings/:id - Delete meeting (instructor/admin) - only for SCHEDULED meetings
export const deleteMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateUUID(id, 'meetingId');

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!meeting) {
      return next(new AppError('Meeting not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, meeting.courseId);

    if (meeting.status !== 'SCHEDULED') {
      return next(new AppError('Only SCHEDULED meetings can be deleted.', 400, 'BAD_REQUEST'));
    }

    await prisma.meeting.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/meetings/diagnostics - Report the live-video provider config (admin).
// Leaks no secrets: only booleans indicating which env vars are present, which
// provider is active, and whether a JaaS token can actually be signed.
export const getMeetingDiagnostics = async (req, res, next) => {
  try {
    const jaasConfigured = isJaasConfigured();
    const jitsiPublicForced = String(process.env.JITSI_PUBLIC).toLowerCase() === 'true';
    const usingPublic = shouldUsePublicJitsi();

    // Try signing a throwaway token to confirm the private key is actually valid.
    let canSignToken = false;
    let signError = null;
    if (jaasConfigured) {
      try {
        signJaasJwt({
          user: { id: 'diagnostic', firstName: 'Diag', lastName: 'Nostic', email: 'diagnostic@212learn.local' },
          roomSlug: 'diagnostic-room',
          moderator: true,
          ttlMinutes: 1,
        });
        canSignToken = true;
      } catch (e) {
        signError = e.message;
      }
    }

    res.status(200).json(successResponse({
      provider: usingPublic ? 'public' : 'jaas',
      recommendation: usingPublic
        ? 'Public meet.jit.si rooms are "members only" and require moderator login — set JITSI_PUBLIC off and provide JaaS credentials for reliable hosting.'
        : 'JaaS is active. New meetings will use your 8x8 tenant.',
      jaasConfigured,
      jitsiPublicForced,
      canSignToken,
      signError,
      jaasDomain: process.env.JAAS_DOMAIN || '8x8.vc',
      publicDomain: PUBLIC_JITSI_DOMAIN,
      envPresent: {
        JAAS_APP_ID: Boolean(process.env.JAAS_APP_ID),
        JAAS_API_KEY_ID: Boolean(process.env.JAAS_API_KEY_ID),
        JAAS_PRIVATE_KEY: Boolean(process.env.JAAS_PRIVATE_KEY),
        JAAS_WEBHOOK_SECRET: Boolean(process.env.JAAS_WEBHOOK_SECRET),
      },
    }));
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/meetings/:id - Fetch a single meeting (status/details).
// Accessible to admins, instructors of the course, and enrolled students.
// Used by the virtual classroom to poll whether the instructor has ended the
// session; a lightweight read that does NOT mint a Jitsi token.
export const getMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateUUID(id, 'meetingId');

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { course: { select: { id: true, title: true } } },
    });

    if (!meeting) {
      return next(new AppError('Meeting not found.', 404, 'NOT_FOUND'));
    }

    const isAdmin = req.user.role === 'admin';
    const isInstructorOnCourse = await prisma.courseInstructor.findFirst({
      where: { courseId: meeting.courseId, userId: req.user.id },
    });
    const isEnrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: req.user.id, courseId: meeting.courseId } },
    });

    if (!isAdmin && !isInstructorOnCourse && !isEnrolled) {
      return next(new AppError('You do not have access to this meeting.', 403, 'FORBIDDEN'));
    }

    res.status(200).json(successResponse({ meeting }));
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/meetings/:id/join - Generate JaaS JWT for meeting access
export const getMeetingJoinInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateUUID(id, 'meetingId');

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!meeting) {
      return next(new AppError('Meeting not found.', 404, 'NOT_FOUND'));
    }

    if (meeting.status === 'COMPLETED') {
      return next(new AppError('This meeting has already ended.', 400, 'MEETING_ENDED'));
    }

    const isAdmin = req.user.role === 'admin';
    const isInstructorOnCourse = await prisma.courseInstructor.findFirst({
      where: { courseId: meeting.courseId, userId: req.user.id },
    });
    const isEnrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: req.user.id, courseId: meeting.courseId } },
      include: { payment: true },
    });

    const moderator = isAdmin || Boolean(isInstructorOnCourse);
    const canJoin = moderator || (isEnrolled && isEnrolled.payment?.status === 'PAID');

    if (!canJoin) {
      return next(new AppError('You do not have access to this meeting.', 403, 'FORBIDDEN'));
    }

    // Public Jitsi: open room, no token. The client joins meet.jit.si/<slug>.
    if (shouldUsePublicJitsi()) {
      return res.status(200).json(successResponse({
        jwt: null,
        domain: PUBLIC_JITSI_DOMAIN,
        roomName: meeting.roomName,
        moderator,
        meeting,
      }));
    }

    const { appId, domain } = getJaasConfig();
    const ttlMinutes = (meeting.durationMinutes || 60) + 15; // buffer past scheduled length
    const token = signJaasJwt({ user: req.user, roomSlug: meeting.roomName, moderator, ttlMinutes });

    res.status(200).json(successResponse({
      jwt: token,
      domain,
      roomName: `${appId}/${meeting.roomName}`,
      moderator,
      meeting,
    }));
  } catch (error) {
    next(error);
  }
};

// Title of the auto-managed section that collects recorded live sessions.
const RECORDINGS_SECTION_TITLE = 'Sessions enregistrées';

/**
 * Store a finished live-session recording in the course "Programme" (curriculum)
 * as a video lesson: find/create the "Sessions enregistrées" section for the
 * course, add a lesson for this meeting, and attach the recording URL as a
 * video Resource. Idempotent — if a Resource with this URL already exists the
 * recording is skipped, so webhook retries don't create duplicates.
 */
export const saveRecordingToCurriculum = async (meeting, recordingUrl) => {
  if (!meeting?.courseId || !recordingUrl) return;

  // Already imported (webhook retry) → no-op.
  const already = await prisma.resource.findFirst({
    where: { url: recordingUrl, lesson: { section: { courseId: meeting.courseId } } },
    select: { id: true },
  });
  if (already) return;

  await prisma.$transaction(async (tx) => {
    let section = await tx.section.findFirst({
      where: { courseId: meeting.courseId, title: RECORDINGS_SECTION_TITLE },
    });
    if (!section) {
      const sectionCount = await tx.section.count({ where: { courseId: meeting.courseId } });
      section = await tx.section.create({
        data: { courseId: meeting.courseId, title: RECORDINGS_SECTION_TITLE, position: sectionCount },
      });
    }

    const lessonCount = await tx.lesson.count({ where: { sectionId: section.id } });
    const dateLabel = new Date(meeting.meetingDate || Date.now()).toLocaleDateString('fr-FR');
    const lesson = await tx.lesson.create({
      data: {
        sectionId: section.id,
        title: `${meeting.title} — enregistrement (${dateLabel})`.slice(0, 255),
        position: lessonCount,
      },
    });

    await tx.resource.create({
      data: { lessonId: lesson.id, type: 'video', url: recordingUrl },
    });
  });
};

// POST /api/v1/meetings/:id/recording — instructor/admin attaches a session
// recording (a Cloudinary video URL from the signed direct upload). Stores it
// on the meeting AND publishes it into the course curriculum so enrolled
// students can watch the replay in the "Sessions enregistrées" section.
export const attachRecording = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'id');
    validateRequired(req.body, ['recordingUrl']);
    const { recordingUrl } = req.body;

    // Accept only a Cloudinary secure_url (same trust rule as lesson resources).
    if (typeof recordingUrl !== 'string' || !/^https:\/\/res\.cloudinary\.com\//.test(recordingUrl)) {
      return next(new AppError(
        'recordingUrl must be a Cloudinary secure_url (upload via /uploads/cloudinary-sign first).',
        400,
        'VALIDATION_ERROR',
      ));
    }

    const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!meeting) {
      return next(new AppError('Meeting not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, meeting.courseId);

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { recordingUrl },
    });

    // Publish the replay into the curriculum for students (idempotent).
    await saveRecordingToCurriculum(updated, recordingUrl);

    res.status(200).json(successResponse({ meeting: updated }));
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/meetings/webhook - Jitsi webhook for recording updates
export const meetingWebhook = async (req, res, next) => {
  try {
    if (!verifyJaasWebhook(req)) {
      return next(new AppError('Invalid webhook signature.', 401, 'INVALID_SIGNATURE'));
    }

    const { eventType, roomName, recordingUrl, participantId, participantName } = req.body;

    if (!roomName) {
      return next(new AppError('Missing required field: roomName', 400, 'BAD_REQUEST'));
    }

    const meeting = await prisma.meeting.findFirst({
      where: { roomName },
    });

    if (!meeting) {
      console.warn(`Webhook: Meeting not found for roomName: ${roomName}`);
      return res.status(200).json({ success: true, message: 'Meeting not found, ignoring webhook' });
    }

    // Handle different event types
    switch (eventType) {
      case 'RECORDING_STARTED':
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { status: 'LIVE' },
        });
        console.log(`Webhook: Recording started for meeting ${meeting.id}`);
        break;

      case 'RECORDING_ENDED':
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { status: 'COMPLETED' },
        });
        console.log(`Webhook: Recording ended for meeting ${meeting.id}`);
        break;

      case 'RECORDING_UPLOADED':
        if (!recordingUrl) {
          return next(new AppError('Missing recordingUrl for RECORDING_UPLOADED event', 400, 'BAD_REQUEST'));
        }
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            recordingUrl,
            status: 'COMPLETED',
          },
        });
        // Also publish the recording into the course curriculum ("Programme").
        await saveRecordingToCurriculum(meeting, recordingUrl);
        console.log(`Webhook: Recording uploaded for meeting ${meeting.id}: ${recordingUrl}`);
        break;

      case 'ROOM_DESTROYED':
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { status: 'COMPLETED' },
        });
        console.log(`Webhook: Room destroyed for meeting ${meeting.id}`);
        break;

      case 'ROOM_CREATED':
        console.log(`Webhook: Room created for meeting ${meeting.id}`);
        break;

      case 'PARTICIPANT_JOINED':
        console.log(`Webhook: Participant joined meeting ${meeting.id}: ${participantName || participantId}`);
        // Future: Store participant analytics
        break;

      case 'PARTICIPANT_LEFT':
        console.log(`Webhook: Participant left meeting ${meeting.id}: ${participantName || participantId}`);
        // Future: Store participant analytics
        break;

      default:
        console.log(`Webhook: Unhandled event type ${eventType} for meeting ${meeting.id}`);
        break;
    }

    res.status(200).json(successResponse({ success: true, eventType }));
  } catch (error) {
    next(error);
  }
};

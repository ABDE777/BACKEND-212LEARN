import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { linkFormateurToCourse } from '../../src/utils/groupSync.js';

// A tiny fake Prisma client that records upsert calls.
const makeClient = () => {
  const calls = [];
  return {
    calls,
    courseInstructor: {
      upsert: async (args) => { calls.push(args); return { id: 'ci-1', ...args.create }; },
    },
  };
};

describe('linkFormateurToCourse', () => {
  it('upserts the (courseId, userId) link with role group_formateur', async () => {
    const client = makeClient();
    await linkFormateurToCourse(client, 'course-1', 'inst-1');

    assert.equal(client.calls.length, 1);
    const args = client.calls[0];
    assert.deepEqual(args.where, { courseId_userId: { courseId: 'course-1', userId: 'inst-1' } });
    assert.deepEqual(args.update, {});
    assert.deepEqual(args.create, { courseId: 'course-1', userId: 'inst-1', role: 'group_formateur' });
  });

  it('is idempotent-safe (uses upsert, never create-only)', async () => {
    const client = makeClient();
    await linkFormateurToCourse(client, 'course-1', 'inst-1');
    await linkFormateurToCourse(client, 'course-1', 'inst-1');
    assert.equal(client.calls.length, 2); // caller may invoke repeatedly; each is an upsert
    for (const c of client.calls) assert.ok(c.where && c.create && 'update' in c);
  });

  it('is a no-op when courseId or formateurId is missing', async () => {
    const client = makeClient();
    await linkFormateurToCourse(client, null, 'inst-1');
    await linkFormateurToCourse(client, 'course-1', null);
    await linkFormateurToCourse(client, undefined, undefined);
    assert.equal(client.calls.length, 0);
  });
});

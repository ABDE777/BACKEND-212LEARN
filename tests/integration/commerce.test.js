import assert from 'node:assert/strict';
import { request, isServerUp, login, auth } from './http.js';

async function run() {
  console.log('🛒 Commerce integration tests (Cart / Wishlist / Coupon)...\n');

  if (!(await isServerUp())) {
    console.log('⏭️  SKIP — API server is not reachable. Start with `npm run dev` then retry.');
    process.exit(0);
  }

  const studentToken = await login('student1@212learn.com');
  const adminToken = await login('admin1@212learn.com');

  const coursesRes = await request('GET', '/courses?limit=5');
  assert.equal(coursesRes.status, 200);
  const courseId = coursesRes.body?.data?.courses?.[0]?.id;
  assert.ok(courseId, 'Need at least one published course');

  // Cart
  const cart1 = await request('GET', '/cart', null, auth(studentToken));
  assert.equal(cart1.status, 200, `get cart: ${JSON.stringify(cart1.body)}`);
  console.log('✅ GET /cart');

  await request('DELETE', '/cart', null, auth(studentToken));

  const add = await request('POST', '/cart/items', { courseId }, auth(studentToken));
  assert.equal(add.status, 201, `add cart: ${JSON.stringify(add.body)}`);
  assert.ok(add.body.data.itemCount >= 1);
  console.log('✅ POST /cart/items');

  const dup = await request('POST', '/cart/items', { courseId }, auth(studentToken));
  assert.equal(dup.status, 409);
  console.log('✅ duplicate cart item → 409');

  const itemId = add.body.data.items.find((i) => i.courseId === courseId)?.id;
  const removed = await request('DELETE', `/cart/items/${itemId}`, null, auth(studentToken));
  assert.equal(removed.status, 200);
  console.log('✅ DELETE /cart/items/:itemId');

  // Wishlist
  await request('DELETE', `/wishlist/${courseId}`, null, auth(studentToken)).catch(() => {});

  const wish = await request('POST', '/wishlist', { courseId }, auth(studentToken));
  assert.equal(wish.status, 201, `wishlist add: ${JSON.stringify(wish.body)}`);
  console.log('✅ POST /wishlist');

  const wishList = await request('GET', '/wishlist', null, auth(studentToken));
  assert.equal(wishList.status, 200);
  assert.ok(wishList.body.data.items.some((i) => i.courseId === courseId));
  console.log('✅ GET /wishlist');

  const wishDel = await request('DELETE', `/wishlist/${courseId}`, null, auth(studentToken));
  assert.equal(wishDel.status, 204);
  console.log('✅ DELETE /wishlist/:courseId');

  // Coupons
  const code = `TEST${Date.now().toString().slice(-6)}`;
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const created = await request(
    'POST',
    '/coupons',
    { code, discount: 15, expirationDate: future },
    auth(adminToken)
  );
  assert.equal(created.status, 201, `create coupon: ${JSON.stringify(created.body)}`);
  console.log('✅ POST /coupons (admin)');

  const validated = await request(
    'POST',
    '/coupons/validate',
    { code: code.toLowerCase(), courseId },
    auth(studentToken)
  );
  assert.equal(validated.status, 200, `validate: ${JSON.stringify(validated.body)}`);
  assert.equal(validated.body.data.discountPercent, 15);
  assert.ok(typeof validated.body.data.finalPrice === 'number');
  console.log('✅ POST /coupons/validate');

  const listed = await request('GET', '/coupons', null, auth(adminToken));
  assert.equal(listed.status, 200);
  console.log('✅ GET /coupons (admin)');

  const deleted = await request('DELETE', `/coupons/${created.body.data.id}`, null, auth(adminToken));
  assert.equal(deleted.status, 204);
  console.log('✅ DELETE /coupons/:id');

  console.log('\n🏁 Commerce integration tests passed');
}

run().catch((err) => {
  console.error('❌ Commerce tests failed:', err);
  process.exit(1);
});

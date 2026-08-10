const API_BASE = 'https://backend-212learn.vercel.app/api/v1';

async function testLogin() {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@212learn.com',
      password: 'password123'
    })
  });
  const data = await response.json();
  console.log('Login response:', data);
  return data.success ? data.token : null;
}

async function testCreateMeeting(token, courseId) {
  const response = await fetch(`${API_BASE}/courses/${courseId}/meetings`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Test Meeting for JaaS Join',
      meetingDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      durationMinutes: 60
    })
  });
  const data = await response.json();
  console.log('Create meeting response:', data);
  return data.success ? data.data.meeting : null;
}

async function testGetCourses(token) {
  const response = await fetch(`${API_BASE}/courses`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  console.log('Courses response:', data);
  return data.success ? data.data.courses : [];
}

async function testMeetingJoin(token, meetingId) {
  const response = await fetch(`${API_BASE}/meetings/${meetingId}/join`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  console.log('Meeting join response:', data);
  return data;
}

async function testGetMeetings(token) {
  const response = await fetch(`${API_BASE}/admin/meetings`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  console.log('Admin meetings response:', data);
  return data.success ? data.data.meetings : [];
}

async function main() {
  try {
    console.log('Testing backend at:', API_BASE);
    
    // Test login
    const token = await testLogin();
    if (!token) {
      console.error('Login failed');
      return;
    }
    console.log('Login successful, token obtained');
    
    // Get courses to create a meeting
    const courses = await testGetCourses(token);
    if (courses.length === 0) {
      console.error('No courses found to create meeting');
      return;
    }
    const courseId = courses[0].id;
    console.log('Using course:', courseId, '-', courses[0].title);
    
    // Create a new SCHEDULED meeting
    console.log('Creating new meeting...');
    const newMeeting = await testCreateMeeting(token, courseId);
    if (!newMeeting) {
      console.error('Failed to create meeting');
      return;
    }
    console.log('Meeting created:', newMeeting.id, '-', newMeeting.title, 'Status:', newMeeting.status);
    
    // Test join on the newly created meeting
    console.log('Testing join for new meeting...');
    await testMeetingJoin(token, newMeeting.id);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

main();

const API_BASE = 'http://localhost:5000/api/v1';

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
  return data.success ? data.data.token : null;
}

async function testGetMeetings(token) {
  const response = await fetch(`${API_BASE}/admin/meetings`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  console.log('Admin meetings response:', data);
  return data.success ? data.data.meetings : [];
}

async function testMeetingJoin(token, meetingId) {
  const response = await fetch(`${API_BASE}/meetings/${meetingId}/join`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  console.log('Meeting join response:', data);
  return data;
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
    
    // Test get all meetings
    const meetings = await testGetMeetings(token);
    console.log('Meetings count:', meetings.length);
    
    if (meetings.length > 0) {
      const firstMeeting = meetings[0];
      console.log('Testing join for meeting:', firstMeeting.id);
      
      // Test meeting join
      await testMeetingJoin(token, firstMeeting.id);
    } else {
      console.log('No meetings found to test join endpoint');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

main();

/**
 * Test file for Candidate API endpoints
 * This demonstrates how to use the candidate duplicate check functionality
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const AUTH_TOKEN = 'your_jwt_token_here'; // Replace with actual token

// Headers for authenticated requests
const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

/**
 * Test 1: Check for duplicate candidates (Core Feature)
 */
async function testDuplicateCheck() {
  console.log('\n🔍 Testing Candidate Duplicate Check...');
  
  try {
    const response = await axios.post(`${BASE_URL}/candidates/check`, {
      pan: 'ABCDE1234F',
      aadhaar: '123456789012',
      email: 'john.doe@example.com',
      phone: '9876543210'
    }, { headers });

    console.log('✅ Duplicate Check Response:', {
      success: response.data.success,
      message: response.data.message,
      hasDuplicates: response.data.hasDuplicates,
      duplicateCount: response.data.data?.duplicateCount || 0
    });

    if (response.data.hasDuplicates) {
      console.log('📋 Duplicate Details:', {
        candidates: response.data.data.candidates.length,
        recommendations: response.data.data.recommendations.length
      });
      
      // Show recommendations
      response.data.data.recommendations.forEach((rec, index) => {
        console.log(`💡 Recommendation ${index + 1}:`, {
          type: rec.type,
          message: rec.message,
          action: rec.action,
          priority: rec.priority
        });
      });
    }

    return response.data;
  } catch (error) {
    console.error('❌ Duplicate Check Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 2: Create new candidate after duplicate check
 */
async function testCreateCandidate() {
  console.log('\n👤 Testing Candidate Creation...');
  
  try {
    const response = await axios.post(`${BASE_URL}/candidates`, {
      pan: 'FGHIJ5678K',
      aadhaar: '987654321098',
      email: 'jane.smith@example.com',
      phone: '8765432109',
      name: 'Jane Smith',
      location: {
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India'
      },
      profile: {
        currentCompany: 'TechCorp',
        currentRole: 'Senior Developer',
        totalExperience: 48, // months
        skills: ['JavaScript', 'React', 'Node.js'],
        preferredRoles: ['Tech Lead', 'Senior Developer'],
        preferredLocations: ['Mumbai', 'Pune'],
        salaryRange: {
          min: 1500000,
          max: 2500000,
          currency: 'INR'
        },
        noticePeriod: 30,
        immediateJoiner: false
      },
      whatsappNumber: '8765432109',
      consent: {
        dataSharing: true,
        whatsappContact: true,
        marketingEmails: false
      }
    }, { headers });

    console.log('✅ Candidate Created:', {
      id: response.data.data.id,
      name: response.data.data.name,
      status: response.data.data.status
    });

    return response.data.data.id;
  } catch (error) {
    console.error('❌ Candidate Creation Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 3: Get candidate details
 */
async function testGetCandidate(candidateId) {
  if (!candidateId) return;
  
  console.log('\n📋 Testing Get Candidate Details...');
  
  try {
    const response = await axios.get(`${BASE_URL}/candidates/${candidateId}`, { headers });

    console.log('✅ Candidate Details:', {
      name: response.data.data.name,
      status: response.data.data.status,
      location: response.data.data.location,
      profile: response.data.data.profile
    });

    return response.data.data;
  } catch (error) {
    console.error('❌ Get Candidate Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 4: Search candidates with filters
 */
async function testSearchCandidates() {
  console.log('\n🔎 Testing Candidate Search...');
  
  try {
    const response = await axios.get(`${BASE_URL}/candidates/search?status=AVAILABLE&location=Mumbai&experience=24&page=1&limit=5`, { headers });

    console.log('✅ Search Results:', {
      total: response.data.data.pagination.total,
      page: response.data.data.pagination.page,
      candidates: response.data.data.candidates.length
    });

    return response.data.data;
  } catch (error) {
    console.error('❌ Search Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 5: Get candidate analytics
 */
async function testGetAnalytics() {
  console.log('\n📊 Testing Candidate Analytics...');
  
  try {
    const response = await axios.get(`${BASE_URL}/candidates/analytics/overview`, { headers });

    console.log('✅ Analytics Data:', {
      totalCandidates: response.data.data.totalCandidates,
      totalOffers: response.data.data.totalOffers,
      duplicateRate: response.data.data.duplicateRate
    });

    return response.data.data;
  } catch (error) {
    console.error('❌ Analytics Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 6: Initiate communication for conflict resolution
 */
async function testInitiateCommunication(candidateId) {
  if (!candidateId) return;
  
  console.log('\n💬 Testing Communication Initiation...');
  
  try {
    const response = await axios.post(`${BASE_URL}/candidates/${candidateId}/communicate`, {
      targetHrId: 'target_hr_id_here', // Replace with actual HR ID
      message: 'I noticed this candidate has multiple offers. Let\'s coordinate to avoid confusion.',
      communicationType: 'WHATSAPP_COORDINATION'
    }, { headers });

    console.log('✅ Communication Initiated:', {
      message: response.data.message,
      whatsappMessage: response.data.data.whatsappMessage.substring(0, 100) + '...',
      targetHr: response.data.data.targetHr
    });

    return response.data.data;
  } catch (error) {
    console.error('❌ Communication Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 7: Get duplicate summary for dashboard
 */
async function testGetDuplicateSummary() {
  console.log('\n📈 Testing Duplicate Summary...');
  
  try {
    const response = await axios.get(`${BASE_URL}/candidates/duplicates/summary`, { headers });

    console.log('✅ Duplicate Summary:', {
      duplicateRate: response.data.data.duplicateRate + '%',
      totalCandidates: response.data.data.totalCandidates,
      candidatesWithCommunications: response.data.data.candidatesWithCommunications,
      resolutionNeeded: response.data.data.resolutionNeeded
    });

    return response.data.data;
  } catch (error) {
    console.error('❌ Duplicate Summary Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting Candidate API Tests...\n');
  
  // Test 1: Duplicate Check
  const duplicateResult = await testDuplicateCheck();
  
  // Test 2: Create Candidate
  const candidateId = await testCreateCandidate();
  
  // Test 3: Get Candidate
  await testGetCandidate(candidateId);
  
  // Test 4: Search Candidates
  await testSearchCandidates();
  
  // Test 5: Get Analytics
  await testGetAnalytics();
  
  // Test 6: Initiate Communication
  await testInitiateCommunication(candidateId);
  
  // Test 7: Get Duplicate Summary
  await testGetDuplicateSummary();
  
  console.log('\n✨ All tests completed!');
}

// Export functions for individual testing
module.exports = {
  testDuplicateCheck,
  testCreateCandidate,
  testGetCandidate,
  testSearchCandidates,
  testGetAnalytics,
  testInitiateCommunication,
  testGetDuplicateSummary,
  runAllTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

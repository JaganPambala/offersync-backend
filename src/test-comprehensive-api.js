/**
 * Test file for comprehensive candidate + offer creation APIs
 * This demonstrates both scenarios:
 * 1. Creating new candidate with offer
 * 2. Creating offer for existing candidate
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api/candidates';
const AUTH_TOKEN = 'your-jwt-token-here'; // Replace with actual token

// Test data
const testCandidateData = {
  pan: 'ABCDE1234F',
  aadhaar: '123456789012',
  email: 'test.candidate@example.com',
  phone: '9876543210',
  name: 'Test Candidate',
  location: {
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India'
  },
  profile: {
    currentCompany: 'Tech Corp',
    currentRole: 'Software Engineer',
    totalExperience: 36, // months
    skills: ['JavaScript', 'Node.js', 'MongoDB'],
    preferredRoles: ['Senior Developer', 'Tech Lead'],
    preferredLocations: ['Mumbai', 'Bangalore'],
    salaryRange: {
      min: 800000,
      max: 1500000,
      currency: 'INR'
    },
    noticePeriod: 30,
    immediateJoiner: false
  },
  whatsappNumber: '9876543210',
  consent: {
    dataSharing: true,
    whatsappContact: true,
    marketingEmails: false,
    consentDate: new Date()
  }
};

const testOfferData = {
  position: {
    title: 'Senior Software Engineer',
    department: 'Engineering',
    level: 'Mid-Senior',
    location: 'Mumbai'
  },
  compensation: {
    base: 1200000,
    variable: 200000,
    benefits: 100000,
    total: 1500000,
    currency: 'INR'
  },
  timeline: {
    offerDate: new Date(),
    joiningDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    responseDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  },
  priority: 'HIGH',
  competition: {
    hasCompetingOffers: false,
    competingCompanies: [],
    marketRate: 1400000
  },
  tags: ['urgent', 'senior-role', 'mumbai-location']
};

/**
 * Scenario 1: Create new candidate with offer
 * Use this when HR fills the complete form
 */
async function testCreateCandidateWithOffer() {
  try {
    console.log('🔄 Testing: Create new candidate with offer...');
    
    const response = await axios.post(`${BASE_URL}/with-offer`, {
      ...testCandidateData,
      ...testOfferData
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Success: Candidate and offer created');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Error creating candidate with offer:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Scenario 2: Create offer for existing candidate
 * Use this when HR clicks "create offer" for existing candidate
 */
async function testCreateOfferForExistingCandidate(candidateId) {
  try {
    console.log('🔄 Testing: Create offer for existing candidate...');
    
    const response = await axios.post(`${BASE_URL}/${candidateId}/offer`, testOfferData, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Success: Offer created for existing candidate');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Error creating offer for existing candidate:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Test duplicate checking
 */
async function testDuplicateCheck() {
  try {
    console.log('🔄 Testing: Duplicate check...');
    
    const response = await axios.post(`${BASE_URL}/check`, {
      pan: testCandidateData.pan,
      aadhaar: testCandidateData.aadhaar,
      email: testCandidateData.email,
      phone: testCandidateData.phone
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Success: Duplicate check completed');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Error in duplicate check:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  try {
    console.log('🚀 Starting comprehensive API tests...\n');

    // Test 1: Duplicate check
    await testDuplicateCheck();
    console.log('');

    // Test 2: Create new candidate with offer
    const result = await testCreateCandidateWithOffer();
    console.log('');

    // Test 3: Create another offer for the same candidate
    if (result && result.candidate) {
      await testCreateOfferForExistingCandidate(result.candidate.id);
    }

    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
  }
}

// Export functions for use in other files
module.exports = {
  testCreateCandidateWithOffer,
  testCreateOfferForExistingCandidate,
  testDuplicateCheck,
  runTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

/**
 * Example: How to Create an Offer with a Candidate
 * This demonstrates the complete flow when a user clicks "Create Offer"
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const AUTH_TOKEN = 'your_jwt_token_here'; // Replace with actual token

const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

/**
 * Example 1: Create Offer with New Candidate (Complete Flow)
 * This is what happens when user clicks "Create Offer" for a new person
 */
async function createOfferWithNewCandidate() {
  console.log('🚀 Example 1: Creating Offer with New Candidate\n');
  
  try {
    const offerData = {
      // Candidate Information (Person applying for job)
      pan: 'ABCDE1234F',
      aadhaar: '123456789012',
      email: 'john.doe@email.com',
      phone: '9876543210',
      name: 'John Doe',
      location: {
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India'
      },
      profile: {
        currentCompany: 'TechCorp',
        currentRole: 'Senior Developer',
        totalExperience: 36, // months
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        preferredRoles: ['Tech Lead', 'Senior Developer'],
        preferredLocations: ['Mumbai', 'Pune'],
        salaryRange: {
          min: 1200000,
          max: 2000000,
          currency: 'INR'
        },
        noticePeriod: 30,
        immediateJoiner: false
      },
      whatsappNumber: '9876543210',
      consent: {
        dataSharing: true,
        whatsappContact: true,
        marketingEmails: false
      },
      
      // Offer Information (Job details)
      position: {
        title: 'Senior Full Stack Developer',
        level: 'Senior',
        department: 'Engineering',
        workMode: 'HYBRID',
        location: {
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India'
        }
      },
      compensation: {
        base: 1500000,
        variable: 200000,
        stocks: 50000,
        bonus: 100000,
        currency: 'INR'
        // total will be auto-calculated: 1,850,000
      },
      timeline: {
        validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        expectedJoinDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) // 45 days
      },
      priority: 'HIGH',
      tags: ['Full Stack', 'React', 'Node.js', 'Senior Level']
    };

    console.log('📝 Sending offer creation request...');
    const response = await axios.post(
      `${BASE_URL}/offers/create-with-candidate`, 
      offerData, 
      { headers }
    );

    if (response.data.success) {
      console.log('✅ Offer created successfully!');
      console.log('📋 Offer Details:');
      console.log(`   Position: ${response.data.data.offer.position.title}`);
      console.log(`   Salary: ${response.data.data.offer.compensation.total.toLocaleString('en-IN')} ${response.data.data.offer.compensation.currency}`);
      console.log(`   Status: ${response.data.data.offer.status}`);
      console.log(`   Priority: ${response.data.data.offer.priority}`);
      
      console.log('\n👤 Candidate Details:');
      console.log(`   Name: ${response.data.data.candidate.name}`);
      console.log(`   Status: ${response.data.data.candidate.status}`);
      console.log(`   ID: ${response.data.data.candidate.id}`);
      
    } else {
      console.log('⚠️ Offer creation requires user decision:');
      console.log(`   Message: ${response.data.message}`);
      console.log(`   Action: ${response.data.action}`);
      
      if (response.data.duplicateInfo) {
        console.log(`   Duplicates found: ${response.data.duplicateInfo.duplicateCount}`);
        console.log('   This means the candidate already exists in the system');
        console.log('   You need to coordinate with other HRs before proceeding');
      }
    }

    return response.data;

  } catch (error) {
    console.error('❌ Error creating offer:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Example 2: Create Offer for Existing Candidate
 * This is when you want to create another offer for someone already in the system
 */
async function createOfferForExistingCandidate() {
  console.log('\n🚀 Example 2: Creating Offer for Existing Candidate\n');
  
  try {
    // First, let's assume we have a candidate ID from a previous search
    const candidateId = 'existing_candidate_id_here'; // Replace with actual ID
    
    const offerData = {
      candidateId: candidateId,
      position: {
        title: 'Tech Lead',
        level: 'Lead',
        department: 'Engineering',
        workMode: 'HYBRID'
      },
      compensation: {
        base: 2000000,
        variable: 300000,
        stocks: 100000,
        bonus: 150000,
        currency: 'INR'
      },
      timeline: {
        validTill: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
        expectedJoinDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
      },
      priority: 'URGENT',
      tags: ['Tech Lead', 'Leadership', 'Engineering']
    };

    console.log('📝 Sending offer creation request for existing candidate...');
    const response = await axios.post(
      `${BASE_URL}/offers/create-for-existing`, 
      offerData, 
      { headers }
    );

    if (response.data.success) {
      console.log('✅ Offer created for existing candidate!');
      console.log('📋 Offer Details:');
      console.log(`   Position: ${response.data.data.offer.position.title}`);
      console.log(`   Salary: ${response.data.data.offer.compensation.total.toLocaleString('en-IN')} ${response.data.data.offer.compensation.currency}`);
      
    } else {
      console.log('⚠️ Offer creation requires coordination:');
      console.log(`   Message: ${response.data.message}`);
      console.log(`   Action: ${response.data.action}`);
      
      if (response.data.data?.existingOffers) {
        console.log(`   Candidate already has ${response.data.data.existingOffers.length} active offer(s)`);
        console.log('   You need to coordinate with other HRs before proceeding');
      }
    }

    return response.data;

  } catch (error) {
    console.error('❌ Error creating offer for existing candidate:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Example 3: What Happens When Duplicates Are Found
 * This shows the duplicate detection flow
 */
async function demonstrateDuplicateDetection() {
  console.log('\n🚀 Example 3: Duplicate Detection Flow\n');
  
  try {
    // Try to create an offer with the same PAN/Aadhaar as Example 1
    const duplicateOfferData = {
      pan: 'ABCDE1234F', // Same PAN as before
      aadhaar: '123456789012', // Same Aadhaar as before
      email: 'john.doe@email.com', // Same email as before
      phone: '9876543210', // Same phone as before
      name: 'John Doe',
      position: {
        title: 'Software Engineer',
        level: 'Mid',
        department: 'Development'
      },
      compensation: {
        base: 1000000,
        currency: 'INR'
      }
    };

    console.log('📝 Attempting to create offer with duplicate candidate data...');
    const response = await axios.post(
      `${BASE_URL}/offers/create-with-candidate`, 
      duplicateOfferData, 
      { headers }
    );

    if (!response.data.success && response.data.action === 'REQUIRES_USER_DECISION') {
      console.log('✅ Duplicate detection working correctly!');
      console.log(`   Message: ${response.data.message}`);
      console.log(`   Duplicates found: ${response.data.duplicateInfo.duplicateCount}`);
      
      console.log('\n📋 Duplicate Information:');
      response.data.duplicateInfo.candidates.forEach((candidate, index) => {
        console.log(`   Candidate ${index + 1}: ${candidate.candidate.name}`);
        console.log(`   Current Status: ${candidate.candidate.status}`);
        console.log(`   HR Contact: ${candidate.hrContact.name} from ${candidate.hrContact.company}`);
        console.log(`   WhatsApp: ${candidate.hrContact.whatsapp}`);
        
        if (candidate.offers.length > 0) {
          console.log(`   Active Offers: ${candidate.offers.length}`);
          candidate.offers.forEach((offer, offerIndex) => {
            console.log(`     Offer ${offerIndex + 1}: ${offer.position.title} at ${offer.hr.company}`);
          });
        }
        console.log('');
      });
      
      console.log('💡 Recommendations:');
      response.data.duplicateInfo.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.type}: ${rec.message}`);
        console.log(`      Action: ${rec.action}, Priority: ${rec.priority}`);
      });
      
      console.log('\n🔄 Next Steps:');
      console.log('   1. Review existing offers and HR contacts');
      console.log('   2. Use WhatsApp coordination to discuss with other HRs');
      console.log('   3. Decide whether to proceed or coordinate');
      
    } else {
      console.log('❌ Duplicate detection not working as expected');
    }

    return response.data;

  } catch (error) {
    console.error('❌ Error in duplicate detection:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Main function to run all examples
 */
async function runAllExamples() {
  console.log('🎯 Running Complete Offer Creation Examples\n');
  console.log('This demonstrates the complete flow when creating offers\n');
  
  // Example 1: Create offer with new candidate
  await createOfferWithNewCandidate();
  
  // Example 2: Create offer for existing candidate
  await createOfferForExistingCandidate();
  
  // Example 3: Demonstrate duplicate detection
  await demonstrateDuplicateDetection();
  
  console.log('\n✨ All examples completed!');
  console.log('\n📚 Summary:');
  console.log('   • Candidates are PEOPLE (job seekers)');
  console.log('   • Offers are JOB PROPOSALS (opportunities)');
  console.log('   • When creating an offer, the system:');
  console.log('     1. Checks for duplicate candidates');
  console.log('     2. Creates candidate if new');
  console.log('     3. Creates the offer');
  console.log('     4. Updates all statuses and metrics');
}

// Export functions for individual testing
module.exports = {
  createOfferWithNewCandidate,
  createOfferForExistingCandidate,
  demonstrateDuplicateDetection,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

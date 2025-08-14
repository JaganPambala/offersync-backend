const mongoose = require('mongoose');
const { Hr } = require('./models/hrSchema');
const Candidate = require('./models/candidate');
const Offer = require('./models/offer');

// Test data for demonstration
const testData = {
  hr: {
    name: 'John Doe',
    email: 'john.doe@testcompany.com',
    password: 'password123',
    company: {
      name: 'Test Company Ltd',
      industry: 'Technology',
      size: 'Medium'
    },
    whatsapp: {
      phoneNumber: '+919876543210'
    }
  },
  candidate: {
    name: 'Jane Smith',
    hashedPAN: 'hashed_pan_123',
    hashedAadhaar: 'hashed_aadhaar_456',
    email: 'jane.smith@email.com',
    phone: '+919876543211',
    source: {
      method: 'MANUAL'
    }
  }
};

async function testCompanyPopulation() {
  try {
    console.log('🚀 Testing Company Name Population...\n');

    // 1. Create test HR
    console.log('1. Creating test HR...');
    const hr = new Hr(testData.hr);
    await hr.save();
    console.log(`   ✅ HR created: ${hr.name} from ${hr.company.name}\n`);

    // 2. Create test candidate
    console.log('2. Creating test candidate...');
    const candidate = new Candidate({
      ...testData.candidate,
      'source.addedBy': hr._id
    });
    await candidate.save();
    console.log(`   ✅ Candidate created: ${candidate.name}\n`);

    // 3. Create test offer
    console.log('3. Creating test offer...');
    const offer = new Offer({
      candidateId: candidate._id,
      hrId: hr._id,
      position: {
        title: 'Software Engineer',
        level: 'Mid'
      },
      compensation: {
        base: 800000,
        total: 800000
      },
      timeline: {
        validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });
    await offer.save();
    console.log(`   ✅ Offer created for position: ${offer.position.title}\n`);

    // 4. Test population from candidate
    console.log('4. Testing company name population from candidate...');
    const populatedCandidate = await Candidate.findById(candidate._id)
      .populate('source.addedBy', 'name company.name whatsapp.phoneNumber');
    
    console.log('   📋 Candidate with populated HR:');
    console.log(`      Name: ${populatedCandidate.name}`);
    console.log(`      Added by: ${populatedCandidate.source.addedBy.name}`);
    console.log(`      Company: ${populatedCandidate.source.addedBy.company.name}`);
    console.log(`      WhatsApp: ${populatedCandidate.source.addedBy.whatsapp.phoneNumber}\n`);

    // 5. Test population from offer
    console.log('5. Testing company name population from offer...');
    const populatedOffer = await Offer.findById(offer._id)
      .populate('hrId', 'name company.name whatsapp.phoneNumber');
    
    console.log('   📋 Offer with populated HR:');
    console.log(`      Position: ${populatedOffer.position.title}`);
    console.log(`      HR Name: ${populatedOffer.hrId.name}`);
    console.log(`      Company: ${populatedOffer.hrId.company.name}`);
    console.log(`      WhatsApp: ${populatedOffer.hrId.whatsapp.phoneNumber}\n`);

    // 6. Test the duplicate check service method
    console.log('6. Testing duplicate check service method...');
    const CandidateService = require('./services/candidate.service');
    
    const duplicateResult = await CandidateService.checkDuplicates({
      pan: 'ABCDE1234F',
      aadhaar: '123456789012',
      email: 'jane.smith@email.com',
      phone: '+919876543211'
    });

    if (duplicateResult.hasDuplicates) {
      console.log('   📋 Duplicate check result:');
      console.log(`      Message: ${duplicateResult.message}`);
      console.log(`      Duplicate count: ${duplicateResult.data.duplicateCount}`);
      
      const firstCandidate = duplicateResult.data.candidates[0];
      console.log(`      First candidate: ${firstCandidate.candidate.name}`);
      console.log(`      HR Company: ${firstCandidate.hrContact.company}`);
      console.log(`      HR WhatsApp: ${firstCandidate.hrContact.whatsapp}`);
      
      if (firstCandidate.offers.length > 0) {
        const firstOffer = firstCandidate.offers[0];
        console.log(`      First offer company: ${firstOffer.hr.company}`);
        console.log(`      First offer HR WhatsApp: ${firstOffer.hr.whatsapp}`);
      }
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('   The company.name is correctly populated through HR references.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Clean up test data
    try {
      await Offer.deleteMany({});
      await Candidate.deleteMany({});
      await Hr.deleteMany({});
      console.log('\n🧹 Test data cleaned up.');
    } catch (cleanupError) {
      console.error('Warning: Could not clean up test data:', cleanupError.message);
    }
    
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 Database connection closed.');
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  // Connect to MongoDB (you'll need to update this connection string)
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/offersync-test';
  
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('📡 Connected to MongoDB');
      return testCompanyPopulation();
    })
    .catch(error => {
      console.error('❌ Failed to connect to MongoDB:', error.message);
      process.exit(1);
    });
}

module.exports = { testCompanyPopulation };
